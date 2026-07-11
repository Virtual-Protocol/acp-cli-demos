#!/usr/bin/env python3
"""
Extractor — the extractor learner (learner two of the v3 design): the expensive
labeler teaches its own cheap replacement, and the routing rate falls.

THE ECONOMICS THIS IMPLEMENTS (indexer economics, one level up):
  The attached MODEL labels superbly but expensively; the lexical labeler
  (cambium.detect_gap firing senses/modalities by token overlap) is free but
  crude — it can never fire a faculty whose name shares no tokens with the text.
  So: route only LOW-CONFIDENCE cases to the model (active learning), record the
  model's labels as (vector, labels) TEACH pairs in telemetry, and distill a tiny
  per-faculty classifier from the accumulating corpus during dream cycles. As the
  distilled labeler sharpens, confidence rises and routing falls — annotation
  cost trends down exactly as generation cost did under replay.

HOW IT LEARNS:
  - teach pair  : base-embedder vector of the text (one-way hashed features —
                  raw text never enters the log) + the model's faculty labels +
                  what the cheap labeler would have said (the baseline).
  - distillation: one sparse logistic head PER FACULTY seen in the teach corpus,
                  trained on a temporal split, stored top-|w| dims only.
  - the bar     : the distilled labeler must beat the CHEAP labeler at matching
                  the model's labels on held-out future pairs — otherwise the
                  guards hold and nothing changes (cold-start protection).
  - the seal    : adoption writes registry/labeler.json and seals an `operator`
                  ring with the weights in blockspace; `rollback` reverts and
                  seals the reversion. Same guarantee as scorer and lens.

CONFIDENCE (what routes): a blend of the cheap labeler's coverage and activation
separation, raised by a sharp distilled prediction once a labeler is active. A
`route` event records each low-confidence request, so the routing-rate curve is
measurable from telemetry — the falling curve is the deliverable.

Stdlib only. Python 3.8+. Consumed by recall.label; trained by dream.py.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

from timechain import Timechain, now_iso
from telemetry import Telemetry, query_hash
from operators import sigmoid as _sigmoid, prior_adopts, next_version, seal_adopt, seal_rollback
from cambium import load_corpus, detect_gap
import embed as embmod
import policy as policymod

SGD_SEED = 1729
SGD_EPOCHS = 25
SGD_LR = 0.2
SGD_L2 = 1e-4
SPARSE_TOP = 64          # store only the strongest dims per faculty head
PREDICT_FLOOR = 0.5      # a distilled label counts when p >= this


def _fkey(kind, fid):
    return f"{kind}:{fid}"


# --------------------------------------------------------------------------- #
# The cheap labeler + its confidence
# --------------------------------------------------------------------------- #

def cheap_label(corpus, text, context=""):
    """What detect_gap fires, as (kind,id) sets — the free baseline."""
    gap = detect_gap(corpus, text, context)
    acts = gap["_acts"]
    senses = [f["id"] for n, f in acts if f["kind"] == "sense"][:5]
    mods = [f["id"] for n, f in acts if f["kind"] == "modality"][:5]
    return {"senses": senses, "modalities": mods,
            "coverage": gap["coverage_ratio"], "dissonance": gap["dissonance"],
            "_acts": acts}


def cheap_confidence(cheap):
    """Coverage x separation: how sure the lexical labeler can honestly be.
    No activations at all = zero confidence (it has nothing to say)."""
    acts = cheap["_acts"]
    if not acts:
        return 0.0
    top = acts[0][0]
    third = acts[2][0] if len(acts) > 2 else 0
    separation = (top - third) / max(1, top)
    return round(min(1.0, 0.5 * cheap["coverage"] + 0.5 * separation), 3)


# --------------------------------------------------------------------------- #
# The distilled labeler
# --------------------------------------------------------------------------- #

def labeler_path(registry_root=None):
    root = Path(registry_root) if registry_root else Path(__file__).resolve().parent
    return root / "registry" / "labeler.json"


def load_labeler(registry_root=None):
    p = labeler_path(registry_root)
    if not p.exists():
        return None
    try:
        lb = json.loads(p.read_text())
        return lb if lb.get("status") == "active" and lb.get("labels") else None
    except Exception:
        return None


def predict_with(labeler, vec, top_k=5, floor=PREDICT_FLOOR):
    """Score every distilled faculty head against a base-space vector."""
    out = []
    for key, head in labeler["labels"].items():
        z = head.get("bias", 0.0)
        for dim, w in head["w"].items():
            z += w * vec[int(dim)]
        p = _sigmoid(z)
        if p >= floor:
            kind, fid = key.split(":", 1)
            out.append({"kind": kind, "id": int(fid), "name": head.get("name", key),
                        "p": round(p, 3)})
    out.sort(key=lambda x: x["p"], reverse=True)
    return out[:top_k]


def predict(text, registry_root=None, top_k=5):
    lb = load_labeler(registry_root)
    if lb is None:
        return []
    base = embmod.get_embedder("hashing")
    if not embmod.compatible(lb.get("base_fingerprint"), base.fingerprint):
        return []
    return predict_with(lb, base.embed(text), top_k=top_k)


# --------------------------------------------------------------------------- #
# Routing + teaching (the active-learning loop)
# --------------------------------------------------------------------------- #

def label(root, text, context="", registry_root=None, emit_route=True):
    """Cheap + distilled labels with a confidence verdict. Low confidence emits
    a `route` request — the model should `teach` this text."""
    pol = policymod.load_policy(registry_root)["extractor"]
    corpus = load_corpus(Path(registry_root) if registry_root else Path(__file__).resolve().parent)
    cheap = cheap_label(corpus, text, context)
    conf = cheap_confidence(cheap)
    distilled = []
    lb = load_labeler(registry_root)
    if lb is not None:
        base = embmod.get_embedder("hashing")
        if embmod.compatible(lb.get("base_fingerprint"), base.fingerprint):
            distilled = predict_with(lb, base.embed(text), top_k=int(pol["top_k"]))
            if distilled:
                conf = max(conf, distilled[0]["p"])
    routed = conf < float(pol["route_confidence"])
    if routed and emit_route:
        Telemetry(root).emit("route", {
            "phase": "request", "text_hash": query_hash(text, context),
            "confidence": conf,
            "cheap": {"senses": cheap["senses"], "modalities": cheap["modalities"]},
            "labeler": (lb or {}).get("labeler_version"),
        })
    return {"cheap": {"senses": cheap["senses"], "modalities": cheap["modalities"]},
            "distilled": distilled, "confidence": conf, "routed": routed,
            "labeler": (lb or {}).get("labeler_version")}


def teach(root, text, senses=None, modalities=None, context="", registry_root=None):
    """The model's labels become a teach pair: base vector + labels + the cheap
    baseline. Raw text never enters the log — the vector is one-way features."""
    corpus = load_corpus(Path(registry_root) if registry_root else Path(__file__).resolve().parent)
    cheap = cheap_label(corpus, text, context)
    base = embmod.get_embedder("hashing")
    e = Telemetry(root).emit("route", {
        "phase": "teach", "text_hash": query_hash(text, context),
        "vector": base.embed(text), "base_fingerprint": base.fingerprint,
        "model": {"senses": sorted(set(senses or [])),
                  "modalities": sorted(set(modalities or []))},
        "cheap": {"senses": cheap["senses"], "modalities": cheap["modalities"]},
    })
    return e is not None


# --------------------------------------------------------------------------- #
# Distillation: train on teach pairs, judged against the cheap baseline
# --------------------------------------------------------------------------- #

def collect_pairs(root):
    pairs = []
    for _, e in Telemetry(root).events():
        if e.get("event") != "route":
            continue
        d = e.get("data", {})
        if d.get("phase") != "teach" or not d.get("vector"):
            continue
        model = d.get("model") or {}
        truth = {_fkey("sense", i) for i in model.get("senses", [])} | \
                {_fkey("modality", i) for i in model.get("modalities", [])}
        cheap = d.get("cheap") or {}
        cheap_set = {_fkey("sense", i) for i in cheap.get("senses", [])} | \
                    {_fkey("modality", i) for i in cheap.get("modalities", [])}
        pairs.append({"vec": d["vector"], "truth": truth, "cheap": cheap_set,
                      "base_fingerprint": d.get("base_fingerprint")})
    return pairs


def _micro_f1(predicted_sets, truth_sets):
    tp = sum(len(p & t) for p, t in zip(predicted_sets, truth_sets))
    fp = sum(len(p - t) for p, t in zip(predicted_sets, truth_sets))
    fn = sum(len(t - p) for p, t in zip(predicted_sets, truth_sets))
    denom = 2 * tp + fp + fn
    return round(2 * tp / denom, 4) if denom else None


def train_labeler(root, registry_root=None):
    pol = policymod.load_policy(registry_root)["extractor"]
    base = embmod.get_embedder("hashing")
    pairs = [p for p in collect_pairs(root)
             if embmod.compatible(p.get("base_fingerprint"), base.fingerprint)]
    n_split = max(1, int(len(pairs) * 0.8))
    train, hold = pairs[:n_split], pairs[n_split:]

    label_counts = {}
    for p in train:
        for key in p["truth"]:
            label_counts[key] = label_counts.get(key, 0) + 1
    targets = [key for key, n in label_counts.items() if n >= 2]

    skill_dir = Path(registry_root) if registry_root else Path(__file__).resolve().parent
    names = {_fkey(f["kind"], f["id"]): f["name"] for f in load_corpus(skill_dir)}
    rng = random.Random(SGD_SEED)
    heads = {}
    for key in targets:
        examples = [(p["vec"], 1 if key in p["truth"] else 0) for p in train]
        bias, w = 0.0, [0.0] * base.dim
        for _ in range(SGD_EPOCHS):
            rng.shuffle(examples)
            for x, y in examples:
                z = bias + sum(wi * xi for wi, xi in zip(w, x))
                g = _sigmoid(z) - y
                bias -= SGD_LR * g
                for i, xi in enumerate(x):
                    if xi:
                        w[i] -= SGD_LR * (g * xi + SGD_L2 * w[i])
        top = sorted(range(len(w)), key=lambda i: abs(w[i]), reverse=True)[:SPARSE_TOP]
        heads[key] = {"name": names.get(key, key), "bias": round(bias, 6),
                      "w": {str(i): round(w[i], 6) for i in top if w[i]}}

    labeler = {"labels": heads, "base_fingerprint": base.fingerprint}
    top_k = int(pol["top_k"])
    distilled_sets, cheap_sets, truth_sets = [], [], []
    for p in hold:
        preds = predict_with(labeler, p["vec"], top_k=top_k)
        distilled_sets.append({_fkey(x["kind"], x["id"]) for x in preds})
        cheap_sets.append(p["cheap"])
        truth_sets.append(p["truth"])
    return {
        "labeler": labeler, "pairs": len(pairs), "train_pairs": len(train),
        "holdout_pairs": len(hold), "faculty_heads": len(heads),
        "eval": {"distilled_f1": _micro_f1(distilled_sets, truth_sets),
                 "cheap_f1": _micro_f1(cheap_sets, truth_sets),
                 "holdout": len(hold)},
    }


def adopt_labeler(root, report, registry_root=None):
    pol = policymod.load_policy(registry_root)["extractor"]
    ev = report["eval"]
    reasons = []
    if report["pairs"] < pol["min_pairs"]:
        reasons.append(f"pairs {report['pairs']} < policy min_pairs {pol['min_pairs']}")
    if ev["holdout"] < 5:
        reasons.append(f"only {ev['holdout']} holdout pairs (< 5)")
    if ev["distilled_f1"] is None or ev["cheap_f1"] is None:
        reasons.append("holdout not scoreable — cannot compare to the cheap labeler")
    elif ev["distilled_f1"] < ev["cheap_f1"] + pol["switchover_margin"]:
        reasons.append(f"distilled F1 {ev['distilled_f1']} does not beat cheap F1 "
                       f"{ev['cheap_f1']} by margin {pol['switchover_margin']}")
    if reasons:
        return {"adopted": False, "reasons": reasons}

    tc = Timechain(root)
    version = next_version(tc, "labeler", "labeler")
    labeler = {
        "labeler_version": version, "status": "active",
        "base_fingerprint": report["labeler"]["base_fingerprint"],
        "labels": report["labeler"]["labels"],
        "trained_at": now_iso(),
        "training": {k: report[k] for k in ("pairs", "train_pairs", "holdout_pairs",
                                            "faculty_heads")},
        "eval": ev,
    }
    p = labeler_path(registry_root)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(labeler, indent=2))
    ring = seal_adopt(
        tc, "labeler",
        (f"Operator adopted: distilled labeler {version} ({report['faculty_heads']} "
         f"faculty heads over frozen {labeler['base_fingerprint']}) trained on "
         f"{report['pairs']} teach pairs; holdout micro-F1 {ev['distilled_f1']} vs "
         f"cheap labeler {ev['cheap_f1']}. The core taught its own cheap "
         f"replacement; routing should now fall. Falsifiable: re-run "
         f"extractor train on the same telemetry range."),
        extra={"labeler_version": version, "training": labeler["training"], "eval": ev},
        files=[p])
    return {"adopted": True, "version": version, "ring": ring["index"],
            "ring_hash": ring["ring_hash"]}


def rollback_labeler(root, registry_root=None):
    tc = Timechain(root)
    adopts = prior_adopts(tc, "labeler")
    p = labeler_path(registry_root)
    if len(adopts) >= 2:
        prev = adopts[-2]
        version = prev["payload"]["labeler_version"]
        restored = False
        for ref in prev.get("blockspace_refs", []):
            if ref.get("role", "").startswith("labeler"):
                p.write_bytes(tc.blockspace.get(ref["hash"]))
                restored = True
        target = version if restored else "cheap labeler (weights unrecoverable)"
        if not restored and p.exists():
            p.unlink()
    else:
        if p.exists():
            p.unlink()
        target = "cheap labeler (no prior labeler operator)"
    ring = seal_rollback(tc, "labeler", target)
    return {"reverted_to": target, "ring": ring["index"]}


def routing_stats(root):
    """The deliverable curve: route requests and teach pairs over time."""
    requests, teaches = 0, 0
    for _, e in Telemetry(root).events():
        if e.get("event") != "route":
            continue
        phase = e.get("data", {}).get("phase")
        if phase == "request":
            requests += 1
        elif phase == "teach":
            teaches += 1
    return {"route_requests": requests, "teach_pairs": teaches}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_label(args):
    r = label(args.root, args.text, args.context or "", args.registry_root)
    print(f"confidence : {r['confidence']}   "
          f"{'ROUTED -> teach me (extractor.py teach)' if r['routed'] else 'confident'}"
          + (f"   [labeler {r['labeler']}]" if r["labeler"] else "   [cheap only]"))
    print(f"cheap      : senses {r['cheap']['senses'] or '-'}  modalities {r['cheap']['modalities'] or '-'}")
    if r["distilled"]:
        print("distilled  : " + ", ".join(f"{x['kind']} #{x['id']} {x['name']} (p={x['p']})"
                                          for x in r["distilled"]))


def cmd_teach(args):
    ok = teach(args.root, args.text, senses=args.senses, modalities=args.modalities,
               context=args.context or "", registry_root=args.registry_root)
    st = routing_stats(args.root)
    print(("teach pair recorded" if ok else "NOT recorded (telemetry off or dormant)")
          + f" — corpus now {st['teach_pairs']} pair(s)")


def cmd_train(args):
    report = train_labeler(args.root, args.registry_root)
    ev = report["eval"]
    print(f"pairs: {report['pairs']} ({report['train_pairs']} train / {report['holdout_pairs']} holdout)"
          f"   faculty heads: {report['faculty_heads']}")
    print(f"holdout: distilled F1 {ev['distilled_f1']}   cheap F1 {ev['cheap_f1']}")
    if args.adopt:
        r = adopt_labeler(args.root, report, args.registry_root)
        if r["adopted"]:
            print(f"ADOPTED {r['version']} — operator Ring {r['ring']} {r['ring_hash'][:16]}..")
        else:
            print("NOT adopted (cold-start guard — cheap labeler remains the baseline):")
            for reason in r["reasons"]:
                print(f"  - {reason}")
            sys.exit(3)


def cmd_rollback(args):
    r = rollback_labeler(args.root, args.registry_root)
    print(f"labeler reverted to: {r['reverted_to']}   (sealed operator Ring {r['ring']})")


def cmd_status(args):
    lb = load_labeler(args.registry_root)
    st = routing_stats(args.root)
    pol = policymod.load_policy(args.registry_root)["extractor"]
    if lb:
        print(f"labeler : {lb['labeler_version']}   {len(lb['labels'])} faculty heads   "
              f"holdout F1 {lb['eval']['distilled_f1']} vs cheap {lb['eval']['cheap_f1']}")
    else:
        print("labeler : none active (cheap lexical labeler only)")
    print(f"routing : {st['route_requests']} request(s), {st['teach_pairs']} teach pair(s)   "
          f"(route below confidence {pol['route_confidence']})")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    common.add_argument("--registry-root", type=Path, default=None)
    p = argparse.ArgumentParser(description="Extractor — the model teaches its own cheap labeler; routing falls.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pl = sub.add_parser("label", parents=[common], help="cheap+distilled labels with confidence; routes when unsure")
    pl.add_argument("text")
    pl.add_argument("--context", default=None)
    pl.set_defaults(func=cmd_label)
    pt = sub.add_parser("teach", parents=[common], help="record the model's labels as a teach pair")
    pt.add_argument("text")
    pt.add_argument("--senses", nargs="*", type=int, default=[])
    pt.add_argument("--modalities", nargs="*", type=int, default=[])
    pt.add_argument("--context", default=None)
    pt.set_defaults(func=cmd_teach)
    pr = sub.add_parser("train", parents=[common], help="distill the teach corpus; judge vs the cheap labeler")
    pr.add_argument("--adopt", action="store_true")
    pr.set_defaults(func=cmd_train)
    pb = sub.add_parser("rollback", parents=[common], help="revert to the previous sealed labeler operator")
    pb.set_defaults(func=cmd_rollback)
    ps = sub.add_parser("status", parents=[common], help="active labeler + the routing-rate numbers")
    ps.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
