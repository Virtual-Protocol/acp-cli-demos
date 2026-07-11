#!/usr/bin/env python3
"""
Learner — the decisions learner (learner three of the v3 design): the hand-tuned
retrieval weights become a logistic model fit on the chain's own telemetry, and
the loop's thresholds become calibrated quantities — within covenant-set policy.

WHAT IT LEARNS, FROM WHAT:
  - SCORER: was an offered ring later FETCHED by the model or DECLARED as used
    evidence? That label, joined from the offer/fetch/use events telemetry already
    records, supervises a logistic regression over the very features the retrieval
    scorer computes (semantic, path, chronological, faculty, salience, noise).
    ε-explored candidates carry their inclusion propensity; their updates are
    importance-weighted (IPS), so the closed loop stays honest.
  - APPETITE: the dissonance -> how-many-blocks curve, calibrated against how many
    blocks the model actually fetched at each need level.
  - POQ THRESHOLDS: grounding_floor positioned from "seals later falsified"
    outcomes at the covenant's target false-seal rate. covenant_floor is POLICY —
    it is never trained, by construction (see policy.py).

THE GUARANTEE (no silent self-modification):
  - Training is OFFLINE — it never runs inside a turn.
  - Evaluation is a TEMPORAL SPLIT: train on the first 80% of offers, evaluate on
    the rest. The chain's ordering gives leakage-free validation for free.
  - ADOPTION IS GUARDED by policy: enough labeled events, and the trained scorer
    must beat the hand weights on the holdout by the switchover margin. Until
    then, the hand weights stay — cold start never degrades the agent.
  - Every adoption (and rollback) SEALS AN OPERATOR RING carrying the weights,
    the training event range, and the holdout evals — falsifiable by re-running.
    `rollback` reverts to the previously sealed operator (or to hand weights),
    and seals that too. Recovery covers the learner, not just the memory.

Stdlib only. Python 3.8+. Builds on telemetry.py, policy.py, timechain.py.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

from timechain import Timechain, now_iso
import telemetry as telem
from operators import sigmoid as _sigmoid, prior_adopts, next_version, seal_adopt, seal_rollback
import policy as policymod

# The shared feature contract between the retrieval scorer and this learner.
# recall.py computes these per candidate; offer events log them; training and
# inference read them identically. Missing features (older events) default 0.
FEATURES = ("semantic", "path", "chronological", "faculty", "salience", "noise_penalty", "quantity")

TRAIN_FRACTION = 0.8
SGD_EPOCHS = 40
SGD_LR = 0.1
SGD_L2 = 1e-4
SGD_SEED = 1729


def features_of(parts, salience):
    """Candidate feature vector (without bias). `parts` is the per-candidate dict
    recall scores with and the offer event logs; salience is the label salience."""
    parts = parts or {}
    return [
        float(parts.get("semantic") or 0.0),
        float(parts.get("path") or 0.0),
        float(parts.get("chronological") or 0.0),
        float(parts.get("faculty") or 0.0),
        float(salience or 0) / 255.0,
        float(parts.get("noise_penalty") or 0.0),
        float(parts.get("quantity") or 0.0),      # absent in pre-v2.8 telemetry -> 0
    ]


def _score_x(weights, x):
    z = weights.get("bias", 0.0)
    for name, xi in zip(FEATURES, x):
        z += weights.get(name, 0.0) * xi
    return _sigmoid(z)


def apply_scorer(scorer, parts, salience):
    """Score a candidate with a trained scorer dict -> probability-shaped score."""
    return _score_x(scorer["weights"], features_of(parts, salience))


def scorer_path(registry_root=None):
    root = Path(registry_root) if registry_root else Path(__file__).resolve().parent
    return root / "registry" / "scorer.json"


def load_scorer(registry_root=None):
    """The active trained scorer, or None (-> hand weights). Never raises."""
    p = scorer_path(registry_root)
    if not p.exists():
        return None
    try:
        s = json.loads(p.read_text())
        return s if s.get("status") == "active" and s.get("weights") else None
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Dataset: join offer -> fetch/use events along the arrow of time
# --------------------------------------------------------------------------- #

def build_dataset(root):
    """Labeled examples over telemetry.join_offers (the canonical credit join):
    a candidate is positive when the model fetched it or declared it used.
    Returns offers: {seq, candidates:[{x, y, w, hand_score, ring}], n_pos}."""
    offers = []
    for o in telem.join_offers(root):
        positives = o["fetched"] | o["used"]
        cands = []
        for c in o["candidates"]:
            cands.append({
                "ring": c["i"],
                "x": features_of(c.get("parts"), c.get("salience")),
                "y": 1 if c["i"] in positives else 0,
                "w": (1.0 / c["propensity"]) if c.get("explore") and c.get("propensity") else 1.0,
                "hand_score": float(c.get("score") or 0.0),
            })
        if cands:
            offers.append({"seq": o["seq"], "candidates": cands,
                           # consumption = fetched OR declared-used — the same
                           # credit the scorer trains on. Counting only raw
                           # fetch events under-measured real consumption and
                           # calibrated appetite toward starvation.
                           "n_fetched": len(o["fetched"] | o["used"]),
                           "n_pos": sum(c["y"] for c in cands),
                           "dissonance": o["dissonance"]})
    return offers


def _mrr(offers, score_fn):
    """Mean reciprocal rank of the positives under a scoring function, over offers
    that have at least one positive (the only ones ranking can be judged on)."""
    total, n = 0.0, 0
    for o in offers:
        if o["n_pos"] == 0 or len(o["candidates"]) < 2:
            continue
        ranked = sorted(o["candidates"], key=score_fn, reverse=True)
        for pos, c in enumerate(ranked, start=1):
            if c["y"] == 1:
                total += 1.0 / pos
                break
        n += 1
    return (round(total / n, 4), n) if n else (None, 0)


def train_scorer(root, registry_root=None):
    """Train the logistic scorer on a temporal split and evaluate against the hand
    weights. Returns the full report; adoption is a separate, guarded step."""
    offers = build_dataset(root)
    n_split = max(1, int(len(offers) * TRAIN_FRACTION))
    train, hold = offers[:n_split], offers[n_split:]
    examples = [(c["x"], c["y"], c["w"]) for o in train for c in o["candidates"]]
    n_pos = sum(1 for _, y, _ in examples if y == 1)

    rng = random.Random(SGD_SEED)
    w = {name: 0.0 for name in FEATURES}
    bias = 0.0
    for _ in range(SGD_EPOCHS):
        rng.shuffle(examples)
        for x, y, wt in examples:
            z = bias + sum(w[name] * xi for name, xi in zip(FEATURES, x))
            g = (_sigmoid(z) - y) * wt
            bias -= SGD_LR * g
            for name, xi in zip(FEATURES, x):
                w[name] -= SGD_LR * (g * xi + SGD_L2 * w[name])

    weights = {"bias": round(bias, 6), **{k: round(v, 6) for k, v in w.items()}}
    trained_mrr, n_eval = _mrr(hold, lambda c: _score_x(weights, c["x"]))
    hand_mrr, _ = _mrr(hold, lambda c: c["hand_score"])
    return {
        "weights": weights,
        "offers": len(offers), "train_offers": len(train), "holdout_offers": len(hold),
        "examples": len(examples), "positives": n_pos,
        "eval": {"trained_mrr": trained_mrr, "hand_mrr": hand_mrr,
                 "ranked_holdout_offers": n_eval},
        "features": list(FEATURES),
    }


def adopt_scorer(root, report, registry_root=None):
    """Guarded switchover: enough events AND the trained scorer beats the hand
    weights on the temporal holdout by the policy margin. Seals an operator ring."""
    pol = policymod.load_policy(registry_root)["scorer"]
    ev = report["eval"]
    reasons = []
    if report["examples"] < pol["min_events"]:
        reasons.append(f"examples {report['examples']} < policy min_events {pol['min_events']}")
    if ev["ranked_holdout_offers"] < 5:
        reasons.append(f"only {ev['ranked_holdout_offers']} rankable holdout offers (< 5)")
    if ev["trained_mrr"] is None or ev["hand_mrr"] is None:
        reasons.append("no rankable holdout — cannot compare to hand weights")
    elif ev["trained_mrr"] < ev["hand_mrr"] + pol["switchover_margin"]:
        reasons.append(f"trained MRR {ev['trained_mrr']} does not beat hand MRR "
                       f"{ev['hand_mrr']} by margin {pol['switchover_margin']}")
    if reasons:
        return {"adopted": False, "reasons": reasons}

    tc = Timechain(root)
    version = next_version(tc, "scorer", "trained")
    scorer = {
        "scorer_version": version, "status": "active", "base": "logistic-v1",
        "features": list(FEATURES), "weights": report["weights"],
        "trained_at": now_iso(),
        "training": {k: report[k] for k in ("offers", "train_offers", "holdout_offers",
                                            "examples", "positives")},
        "eval": ev,
    }
    sp = scorer_path(registry_root)
    sp.parent.mkdir(parents=True, exist_ok=True)
    sp.write_text(json.dumps(scorer, indent=2))
    ring = seal_adopt(
        tc, "scorer",
        (f"Operator adopted: retrieval scorer {version} (logistic over "
         f"{len(FEATURES)} features) trained on {report['examples']} telemetry "
         f"examples from {report['offers']} offers; temporal holdout MRR "
         f"{ev['trained_mrr']} vs hand {ev['hand_mrr']} "
         f"over {ev['ranked_holdout_offers']} offers. Falsifiable: re-run "
         f"learner train on the same telemetry range."),
        extra={"scorer": scorer}, files=[sp])
    return {"adopted": True, "version": version, "ring": ring["index"],
            "ring_hash": ring["ring_hash"]}


def rollback_scorer(root, registry_root=None):
    """Revert to the PREVIOUS sealed scorer operator (or to hand weights if none),
    and seal the reversion. The bad operator stays in history — a scar, not an edit."""
    tc = Timechain(root)
    adopts = prior_adopts(tc, "scorer")
    sp = scorer_path(registry_root)
    if len(adopts) >= 2:
        prev = adopts[-2]["payload"]["scorer"]
        sp.write_text(json.dumps(prev, indent=2))
        target = prev["scorer_version"]
    else:
        if sp.exists():
            sp.unlink()
        target = "hand (no prior trained operator)"
    ring = seal_rollback(tc, "scorer", target)
    return {"reverted_to": target, "ring": ring["index"]}


# --------------------------------------------------------------------------- #
# Appetite + PoQ calibration
# --------------------------------------------------------------------------- #

def calibrate_appetite(root, registry_root=None, adopt=False):
    """Fit the dissonance -> blocks-actually-fetched curve from offer/fetch joins.

    EPOCH-AWARE (v3.23.1): only offers recorded since the turn-auto-recall
    fetch instrumentation exists are fit material. Before that epoch, the loop
    consumed recalled blocks without emitting fetch credit, so every earlier
    offer reads as zero consumption — censored data, not preference. Fitting
    on it calibrated appetite to starvation twice (the v3.21 incident)."""
    watermark = None
    try:
        n_offers = 0                       # same counting space as join_offers' seq
        for _, e in telem.Telemetry(root).events():
            if e.get("event") == "offer":
                n_offers += 1
            elif (e.get("event") == "fetch"
                    and (e.get("data") or {}).get("source") == "turn-auto-recall"):
                watermark = n_offers       # the offer this first credit landed on
                break
    except Exception:
        watermark = None
    offers = [o for o in build_dataset(root) if o["dissonance"] is not None]
    if watermark is not None:
        # The marker exists: everything before it mixes censored turn-loop
        # offers with credited manual ones — fit only on the clean epoch.
        offers = [o for o in offers if o["seq"] >= watermark]
    # No marker: this chain never ran the instrumented turn loop, so its fetch
    # events (manual index/fetch workflow) are genuine credit — fit on all of
    # it; the degeneracy guard below still refuses an all-zero curve.
    pol = policymod.load_policy(registry_root)["appetite"]
    buckets = []
    for lo in range(0, 256, 32):
        rows = [o["n_fetched"] for o in offers if lo <= o["dissonance"] < lo + 32]
        if rows:
            buckets.append({"lo": lo, "hi": lo + 31,
                            "mean_fetched": round(sum(rows) / len(rows), 3), "n": len(rows)})
    # Degeneracy guard: a curve that is zero in EVERY bucket says "this mind
    # never consumes memory" — that is censored instrumentation, not a real
    # preference, and adopting it force-starves retrieval chain-wide while
    # every dashboard stays green (the v3.21 starvation incident, twice).
    degenerate = bool(buckets) and all(b["mean_fetched"] == 0.0 for b in buckets)
    report = {"offers": len(offers), "curve": buckets,
              "min_events": pol["min_events"],
              "eligible": len(offers) >= pol["min_events"] and not degenerate}
    if degenerate:
        report["degenerate"] = True
    if adopt and report["eligible"] and buckets:
        policymod.write_calibration("appetite", {"curve": buckets, "fitted_on": len(offers),
                                                 "at": now_iso()}, registry_root)
        report["adopted"] = True
    elif adopt:
        report["adopted"] = False
        report["reason"] = ("degenerate: every bucket mean_fetched=0 — censored "
                            "consumption telemetry; refusing to adopt a starvation curve"
                            if degenerate else
                            f"offers {len(offers)} < policy min_events {pol['min_events']}"
                            if len(offers) < pol["min_events"] else "no populated buckets")
    return report


def calibrate_poq(root, registry_root=None, adopt=False):
    """Position grounding_floor from sealed-then-falsified outcomes at the policy's
    target false-seal rate. covenant_floor is policy and is NEVER touched here."""
    tel = telem.Telemetry(root)
    seals, falsified = [], set()
    for _, e in tel.events():
        d = e.get("data", {})
        if e.get("event") == "use" and d.get("decision") == "SEAL" and d.get("sealed_ring") is not None:
            seals.append({"ring": d["sealed_ring"], "grounding": d.get("grounding") or 0,
                          "assertiveness": d.get("assertiveness") or 0})
        elif e.get("event") == "falsify" and d.get("ring_index") is not None:
            falsified.add(d["ring_index"])
    pol = policymod.load_policy(registry_root)["poq"]
    joined = [{**s, "falsified": s["ring"] in falsified} for s in seals]
    n_falsified = sum(1 for j in joined if j["falsified"])
    report = {"seals": len(seals), "falsified": n_falsified,
              "min_events": pol["min_events"],
              "target_false_seal_rate": pol["target_false_seal_rate"],
              "eligible": len(seals) >= pol["min_events"] and n_falsified >= 3}
    if not report["eligible"]:
        report["note"] = ("insufficient falsification evidence — thresholds stay at "
                          "defaults; keep operating, the events accrue on their own")
        return report
    # Smallest grounding floor whose surviving seals stay under the tolerated rate.
    target = pol["target_false_seal_rate"]
    floor = None
    for g in sorted({j["grounding"] for j in joined}):
        kept = [j for j in joined if j["grounding"] >= g]
        if kept and sum(1 for j in kept if j["falsified"]) / len(kept) <= target:
            floor = g
            break
    report["grounding_floor"] = floor
    if adopt and floor is not None:
        policymod.write_calibration("poq", {"grounding_floor": floor,
                                            "fitted_on_seals": len(seals),
                                            "falsified": n_falsified,
                                            "at": now_iso()}, registry_root)
        report["adopted"] = True
    return report


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_train(args):
    report = train_scorer(args.root, args.registry_root)
    ev = report["eval"]
    print(f"dataset: {report['offers']} offers -> {report['examples']} examples "
          f"({report['positives']} positive) | split {report['train_offers']}/{report['holdout_offers']}")
    print(f"weights: {report['weights']}")
    print(f"holdout: trained MRR {ev['trained_mrr']}   hand MRR {ev['hand_mrr']}   "
          f"(over {ev['ranked_holdout_offers']} rankable offers)")
    if args.adopt:
        r = adopt_scorer(args.root, report, args.registry_root)
        if r["adopted"]:
            print(f"ADOPTED {r['version']} — operator Ring {r['ring']} {r['ring_hash'][:16]}..")
        else:
            print("NOT adopted (cold-start guard — hand weights remain):")
            for reason in r["reasons"]:
                print(f"  - {reason}")
            sys.exit(3)


def cmd_rollback(args):
    r = rollback_scorer(args.root, args.registry_root)
    print(f"scorer reverted to: {r['reverted_to']}   (sealed operator Ring {r['ring']})")


def cmd_appetite(args):
    r = calibrate_appetite(args.root, args.registry_root, adopt=args.adopt)
    print(f"offers with dissonance: {r['offers']} (policy min {r['min_events']})")
    for b in r["curve"]:
        print(f"  dissonance {b['lo']:>3}-{b['hi']:<3} -> mean fetched {b['mean_fetched']} (n={b['n']})")
    if args.adopt:
        print("calibration adopted into policy.json" if r.get("adopted")
              else f"not adopted: {r.get('reason', 'insufficient data')}")


def cmd_calibrate_poq(args):
    r = calibrate_poq(args.root, args.registry_root, adopt=args.adopt)
    print(f"seals: {r['seals']}   later falsified: {r['falsified']}   "
          f"(policy min {r['min_events']}, target rate {r['target_false_seal_rate']})")
    if not r["eligible"]:
        print(f"  {r['note']}")
    else:
        print(f"  calibrated grounding_floor: {r['grounding_floor']}"
              + ("   (adopted into policy.json)" if r.get("adopted") else ""))
    print("  covenant_floor: POLICY — never trained, never touched here.")


def cmd_status(args):
    s = load_scorer(args.registry_root)
    pol = policymod.load_policy(args.registry_root)
    tel = telem.Telemetry(args.root).stats()
    print(f"retrieval scorer : {s['scorer_version'] if s else 'hand-2.1 (no trained operator active)'}")
    if s:
        print(f"  holdout MRR {s['eval']['trained_mrr']} vs hand {s['eval']['hand_mrr']}  "
              f"trained {s['trained_at']}")
    cal_app = pol.get("appetite", {}).get("calibrated")
    cal_poq = pol.get("poq", {}).get("calibrated")
    print(f"appetite curve   : {'calibrated (' + str(len(cal_app['curve'])) + ' buckets)' if cal_app else 'formula (uncalibrated)'}")
    print(f"poq grounding    : {('calibrated floor ' + str(cal_poq['grounding_floor'])) if cal_poq else 'default floor (uncalibrated)'}")
    print(f"exploration ε    : {pol['exploration']['epsilon']}  (window {pol['exploration']['window']})")
    print(f"telemetry        : {tel['events']} events ({tel['by_type']})")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root, help="chain whose telemetry to learn from")
    common.add_argument("--registry-root", type=Path, default=None)
    p = argparse.ArgumentParser(description="Learner — the decisions learner over the chain's own telemetry.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pt = sub.add_parser("train", parents=[common], help="train + evaluate the scorer on a temporal split")
    pt.add_argument("--adopt", action="store_true", help="switch over if the policy guards pass (seals an operator ring)")
    pt.set_defaults(func=cmd_train)
    pr = sub.add_parser("rollback", parents=[common], help="revert to the previous sealed scorer operator")
    pr.set_defaults(func=cmd_rollback)
    pa = sub.add_parser("appetite", parents=[common], help="calibrate the dissonance->fetch appetite curve")
    pa.add_argument("--adopt", action="store_true")
    pa.set_defaults(func=cmd_appetite)
    pq = sub.add_parser("calibrate-poq", parents=[common], help="position grounding_floor at the covenant's false-seal tolerance")
    pq.add_argument("--adopt", action="store_true")
    pq.set_defaults(func=cmd_calibrate_poq)
    ps = sub.add_parser("status", parents=[common], help="active scorer, calibrations, ε, telemetry volume")
    ps.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
