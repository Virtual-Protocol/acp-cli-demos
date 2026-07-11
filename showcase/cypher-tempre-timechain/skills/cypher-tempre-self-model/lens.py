#!/usr/bin/env python3
"""
Lens — the representation learner (learner one of the v3 design): a trainable
projection head over the FROZEN stdlib embedder, tuned on the chain's own
telemetry pairs, sealed into the chain as a falsifiable operator.

WHY A HEAD, NOT A NEW EMBEDDER:
  The base HashingEmbedder is deterministic, stdlib-pure, and frozen — sealed
  vectors in old rings stay valid forever. But its similarity is morphological,
  not semantic: it cannot learn that THIS agent's queries about "alpha beta"
  habitually resolve to rings about "zebra yankee". A small linear projection
  (d_in -> d_out) CAN learn exactly such associations from lived pairs — and a
  head over a frozen base cannot catastrophically forget the base geometry, only
  re-weight it. The record never changes; the LENS the agent reads it through
  does. That is the chain/index division of labor, applied to meaning itself.

WHAT IT TRAINS ON (mined from telemetry, no annotation step):
  positives  : offered rings the model FETCHED or declared USED for a query;
               REPLAY-ACCEPT certified pairs (query <-> antecedent ring)
  negatives  : offered-but-unfetched rings (soft), REPLAY-REJECT (hard)
  query side : the offer's redacted label keywords/entities — raw queries are
               never logged (privacy), so the proxy text stands in
  loss       : pairwise logistic over triplets — sigmoid(sim(q,pos) - sim(q,neg))
               with IPS in spirit: explored candidates entered the choice set with
               known propensity, so the dataset is not pure selection bias

THE GUARANTEE (same shape as the decisions learner):
  - Trains OFFLINE (dream cycles), never inside a turn.
  - Temporal split: train on the first 80% of offers, judge on the rest.
  - Adoption is policy-guarded: enough pairs AND the lens must beat the BASE
    embedder's ranking on the holdout by the switchover margin.
  - Every adoption seals an `operator` ring: weights blob in blockspace, base
    fingerprint, training range, holdout evals. `rollback` reverts the ACTIVE
    pointer and seals that too. The active lens composes its fingerprint as
    `<base>+<lens-version>`, so every sealed vector and every index bank knows
    exactly which space it lives in (Phase A fingerprints do the bookkeeping).

Stdlib only. Python 3.8+. Companion to embed.py; consumed via the embedder seam.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

from timechain import Timechain, now_iso
import telemetry as telem
from operators import sigmoid as _sigmoid, prior_adopts, next_version, seal_adopt, seal_rollback
import embed as embmod
import policy as policymod

SGD_SEED = 1729
ROUND = 5


def _nonzero(vec):
    return [(i, x) for i, x in enumerate(vec) if x]


def _normalize(vec):
    n = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / n for x in vec]


class ProjectionHead:
    """A d_in x d_out linear map. `project` is sparse over the input's nonzero
    dims, so short texts cost ~nnz*d_out multiplies — microseconds at 256x32."""

    def __init__(self, weights, base_fingerprint, version, meta=None):
        self.w = weights                      # list of d_in rows, each d_out floats
        self.base_fingerprint = base_fingerprint
        self.version = version
        self.meta = meta or {}
        self.d_in = len(weights)
        self.d_out = len(weights[0]) if weights else 0

    def project(self, vec, normed=True):
        out = [0.0] * self.d_out
        for i, x in _nonzero(vec):
            row = self.w[i]
            for j in range(self.d_out):
                out[j] += x * row[j]
        return _normalize(out) if normed else out

    def to_json(self):
        return {
            "lens_version": self.version,
            "base_fingerprint": self.base_fingerprint,
            "d_in": self.d_in, "d_out": self.d_out,
            "weights": [[round(x, ROUND) for x in row] for row in self.w],
            **self.meta,
        }

    @classmethod
    def from_json(cls, data):
        meta = {k: v for k, v in data.items()
                if k not in ("lens_version", "base_fingerprint", "d_in", "d_out", "weights")}
        return cls(data["weights"], data["base_fingerprint"], data["lens_version"], meta)


class LensedEmbedder:
    """The base embedder seen through the trained head. Rides the existing
    embedder seam: same .embed interface, its OWN fingerprint (so Phase A's
    provenance machinery keeps lensed and base vectors apart automatically),
    and `lift` to project an already-sealed BASE vector without re-embedding."""
    name = "lens"

    def __init__(self, base, head):
        self.base = base
        self.head = head
        self.dim = head.d_out
        self.window_chars = getattr(base, "window_chars", None)

    @property
    def fingerprint(self):
        return f"{self.base.fingerprint}+{self.head.version}"

    def embed(self, text):
        return self.head.project(self.base.embed(text))

    def lift(self, sealed_vec, sealed_fingerprint):
        """Project a SEALED vector into lens space — valid only if it was sealed
        in this head's base space. Returns None when the spaces don't match."""
        if not embmod.compatible(sealed_fingerprint, self.head.base_fingerprint):
            return None
        if len(sealed_vec or []) != self.head.d_in:
            return None
        return self.head.project(sealed_vec)


# --------------------------------------------------------------------------- #
# Storage: registry/lens/<version>.json + ACTIVE pointer
# --------------------------------------------------------------------------- #

def lens_dir(registry_root=None):
    root = Path(registry_root) if registry_root else Path(__file__).resolve().parent
    return root / "registry" / "lens"


def load_active(registry_root=None):
    """The ACTIVE lens as a LensedEmbedder, or None. Never raises; a missing or
    base-incompatible lens simply means 'no lens' (base embedder remains sound)."""
    d = lens_dir(registry_root)
    active = d / "ACTIVE"
    if not active.exists():
        return None
    try:
        version = active.read_text().strip()
        head = ProjectionHead.from_json(json.loads((d / f"{version}.json").read_text()))
        base = embmod.get_embedder("hashing")
        if not embmod.compatible(head.base_fingerprint, base.fingerprint):
            return None
        return LensedEmbedder(base, head)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Pair mining: the offer/fetch/use/replay joins, with ring text resolved
# --------------------------------------------------------------------------- #

def mine_offers(root):
    """Chronological offers with query-proxy text, candidate ids, positives and
    hard negatives — read from telemetry.join_offers (the same canonical join
    the decisions learner trains on), plus the replay-certified pairs."""
    offers = []
    for o in telem.join_offers(root):
        cands = [c.get("i") for c in o["candidates"]]
        # Positives are the MODEL's judgments wherever they landed: fetched or
        # declared-used rings count even when retrieval never offered them —
        # that unoffered-but-used case IS the missed-positive, the strongest
        # retrieval-failure signal there is (the answer blocks sit sealed and
        # unranked while a homophone tops the offer). The lens
        # trains on exactly the associations one-shot retrieval lacked.
        pos = o["fetched"] | o["used"] | o["replay_pos"]
        if o["proxy"] and cands:
            offers.append({"proxy": o["proxy"], "cands": cands,
                           "pos": pos, "hard_neg": set(o["replay_neg"])})
    return offers


def _ring_texts(root, ids):
    from recall import block_text
    wanted = set(ids)
    out = {}
    for r in Timechain(root).load():
        if r.get("index") in wanted:
            out[r["index"]] = block_text(r)
    return out


def build_triplets(root, offers, base, max_per_offer=4):
    """(query_proxy_vec, pos_vec, neg_vec) triplets. Hard negatives (replay
    rejects) are preferred; offered-but-unfetched fill the rest."""
    need = set()
    for o in offers:
        need |= o["pos"] | o["hard_neg"] | set(o["cands"])
    texts = _ring_texts(root, need)
    vecs = {i: base.embed(t) for i, t in texts.items() if t}
    triplets = []
    for o in offers:
        pos = [p for p in o["pos"] if p in vecs]
        soft = [c for c in o["cands"] if c not in o["pos"] and c in vecs]
        hard = [n for n in o["hard_neg"] if n in vecs]
        if not pos or not (soft or hard):
            continue
        qv = base.embed(o["proxy"])
        made = 0
        for p in pos[:2]:
            for n in (hard + soft)[:2]:
                triplets.append((qv, vecs[p], vecs[n]))
                made += 1
                if made >= max_per_offer:
                    break
            if made >= max_per_offer:
                break
    return triplets


# --------------------------------------------------------------------------- #
# Training: pairwise logistic over triplets, sparse SGD
# --------------------------------------------------------------------------- #

def train_head(triplets, d_in, d_out, epochs, lr, seed=SGD_SEED, l2=1e-4):
    rng = random.Random(seed)
    w = [[rng.gauss(0, 0.1) for _ in range(d_out)] for _ in range(d_in)]
    head = ProjectionHead(w, base_fingerprint=None, version="training")
    for _ in range(epochs):
        rng.shuffle(triplets)
        for q, p, n in triplets:
            u = head.project(q, normed=False)
            vp = head.project(p, normed=False)
            vn = head.project(n, normed=False)
            delta = sum(a * (b - c) for a, b, c in zip(u, vp, vn))
            g = _sigmoid(-delta)              # dL/dΔ magnitude for L = softplus(-Δ)
            if g < 1e-6:
                continue
            diff = [b - c for b, c in zip(vp, vn)]
            for i, x in _nonzero(q):          # ∂Δ/∂W[i][j] += q[i]·(vp-vn)[j]
                row = w[i]
                for j in range(d_out):
                    row[j] += lr * (g * x * diff[j] - l2 * row[j])
            pn = [a - b for a, b in zip(p, n)]
            for i, x in _nonzero(pn):         # ∂Δ/∂W[i][j] += (p-n)[i]·u[j]
                row = w[i]
                for j in range(d_out):
                    row[j] += lr * (g * x * u[j] - l2 * row[j])
    return head


def _mrr_rank(offers, vecs, score):
    total, n = 0.0, 0
    for o in offers:
        cands = [c for c in o["cands"] if c in vecs]
        if not o["pos"] or len(cands) < 2:
            continue
        qv = o["_qv"]
        ranked = sorted(cands, key=lambda c: score(qv, vecs[c]), reverse=True)
        for pos_rank, c in enumerate(ranked, start=1):
            if c in o["pos"]:
                total += 1.0 / pos_rank
                break
        n += 1
    return (round(total / n, 4), n) if n else (None, 0)


def train_lens(root, registry_root=None):
    """Mine pairs, train on the temporal 80%, judge lens-vs-base on the rest."""
    pol = policymod.load_policy(registry_root)["lens"]
    base = embmod.get_embedder("hashing")
    offers = mine_offers(root)
    n_split = max(1, int(len(offers) * 0.8))
    train, hold = offers[:n_split], offers[n_split:]
    triplets = build_triplets(root, train, base)
    head = train_head(triplets, base.dim, int(pol["d_out"]),
                      int(pol["epochs"]), float(pol["lr"]))
    head.base_fingerprint = base.fingerprint

    need = set()
    for o in hold:
        need |= set(o["cands"]) | o["pos"]
    texts = _ring_texts(root, need)
    base_vecs = {i: base.embed(t) for i, t in texts.items() if t}
    lens_vecs = {i: head.project(v) for i, v in base_vecs.items()}
    for o in hold:
        o["_qv"] = base.embed(o["proxy"])
    base_mrr, n_eval = _mrr_rank(hold, base_vecs, lambda q, v: embmod.cosine(q, v))
    for o in hold:
        o["_qv"] = head.project(o["_qv"])
    lens_mrr, _ = _mrr_rank(hold, lens_vecs, lambda q, v: embmod.cosine(q, v))

    return {
        "head": head,
        "offers": len(offers), "train_offers": len(train), "holdout_offers": len(hold),
        "pairs": len(triplets), "d_in": base.dim, "d_out": head.d_out,
        "base_fingerprint": base.fingerprint,
        "eval": {"lens_mrr": lens_mrr, "base_mrr": base_mrr,
                 "ranked_holdout_offers": n_eval},
    }


def adopt_lens(root, report, registry_root=None):
    """Guarded switchover; on pass, persist the head, move ACTIVE, seal the operator."""
    pol = policymod.load_policy(registry_root)["lens"]
    ev = report["eval"]
    reasons = []
    if report["pairs"] < pol["min_pairs"]:
        reasons.append(f"pairs {report['pairs']} < policy min_pairs {pol['min_pairs']}")
    if ev["ranked_holdout_offers"] < 5:
        reasons.append(f"only {ev['ranked_holdout_offers']} rankable holdout offers (< 5)")
    if ev["lens_mrr"] is None or ev["base_mrr"] is None:
        reasons.append("no rankable holdout — cannot compare to the base embedder")
    elif ev["lens_mrr"] < ev["base_mrr"] + pol["switchover_margin"]:
        reasons.append(f"lens MRR {ev['lens_mrr']} does not beat base MRR "
                       f"{ev['base_mrr']} by margin {pol['switchover_margin']}")
    if reasons:
        return {"adopted": False, "reasons": reasons}

    tc = Timechain(root)
    version = next_version(tc, "lens", "lens")
    head = report["head"]
    head.version = version
    head.meta = {"trained_at": now_iso(),
                 "training": {k: report[k] for k in ("offers", "train_offers",
                                                     "holdout_offers", "pairs")},
                 "eval": ev}
    d = lens_dir(registry_root)
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{version}.json"
    path.write_text(json.dumps(head.to_json(), separators=(",", ":")))
    (d / "ACTIVE").write_text(version + "\n")
    ring = seal_adopt(
        tc, "lens",
        (f"Operator adopted: representation lens {version} "
         f"({report['d_in']}->{report['d_out']} projection over frozen "
         f"{report['base_fingerprint']}), trained on {report['pairs']} telemetry "
         f"pairs from {report['train_offers']} offers; temporal holdout MRR "
         f"{ev['lens_mrr']} vs base {ev['base_mrr']} over "
         f"{ev['ranked_holdout_offers']} offers. Weights in blockspace; "
         f"falsifiable by re-running lens train."),
        extra={"lens_version": version,
               "base_fingerprint": report["base_fingerprint"],
               "d_in": report["d_in"], "d_out": report["d_out"],
               "training": head.meta["training"], "eval": ev},
        files=[path])
    return {"adopted": True, "version": version, "ring": ring["index"],
            "ring_hash": ring["ring_hash"]}


def rollback_lens(root, registry_root=None):
    """Revert ACTIVE to the previous sealed lens (restoring its weights from
    blockspace if the file is gone), or to the bare base embedder. Sealed."""
    tc = Timechain(root)
    adopts = prior_adopts(tc, "lens")
    d = lens_dir(registry_root)
    if len(adopts) >= 2:
        prev = adopts[-2]
        version = prev["payload"]["lens_version"]
        path = d / f"{version}.json"
        if not path.exists():
            for ref in prev.get("blockspace_refs", []):
                if ref.get("role", "").startswith(version):
                    d.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(tc.blockspace.get(ref["hash"]))
        (d / "ACTIVE").write_text(version + "\n")
        target = version
    else:
        active = d / "ACTIVE"
        if active.exists():
            active.unlink()
        target = "base embedder (no prior lens operator)"
    ring = seal_rollback(tc, "lens", target)
    return {"reverted_to": target, "ring": ring["index"]}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_train(args):
    report = train_lens(args.root, args.registry_root)
    ev = report["eval"]
    print(f"pairs: {report['pairs']} triplets from {report['train_offers']} offers "
          f"(holdout {report['holdout_offers']}) | head {report['d_in']}->{report['d_out']}")
    print(f"holdout: lens MRR {ev['lens_mrr']}   base MRR {ev['base_mrr']}   "
          f"(over {ev['ranked_holdout_offers']} rankable offers)")
    if args.adopt:
        r = adopt_lens(args.root, report, args.registry_root)
        if r["adopted"]:
            print(f"ADOPTED {r['version']} — operator Ring {r['ring']} {r['ring_hash'][:16]}..")
        else:
            print("NOT adopted (cold-start guard — base embedder remains):")
            for reason in r["reasons"]:
                print(f"  - {reason}")
            sys.exit(3)


def cmd_status(args):
    e = load_active(args.registry_root)
    if e is None:
        print("lens: none active (base embedder in use). Train one: python3 lens.py train --adopt")
        return
    m = e.head.meta
    print(f"lens: {e.head.version}   space {e.head.d_in}->{e.head.d_out}   "
          f"fingerprint {e.fingerprint}")
    if m.get("eval"):
        print(f"  holdout MRR {m['eval']['lens_mrr']} vs base {m['eval']['base_mrr']}   "
              f"trained {m.get('trained_at')}")


def cmd_rollback(args):
    r = rollback_lens(args.root, args.registry_root)
    print(f"lens reverted to: {r['reverted_to']}   (sealed operator Ring {r['ring']})")


def cmd_sim(args):
    base = embmod.get_embedder("hashing")
    e = load_active(args.registry_root)
    print(f"base cosine: {embmod.cosine(base.embed(args.a), base.embed(args.b)):.4f}")
    if e is not None:
        print(f"lens cosine: {embmod.cosine(e.embed(args.a), e.embed(args.b)):.4f}   ({e.head.version})")
    else:
        print("lens cosine: (no active lens)")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root, help="chain whose telemetry to learn from")
    common.add_argument("--registry-root", type=Path, default=None)
    p = argparse.ArgumentParser(description="Lens — trainable projection over the frozen embedder.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pt = sub.add_parser("train", parents=[common], help="mine pairs, train, judge lens-vs-base on a temporal holdout")
    pt.add_argument("--adopt", action="store_true", help="switch over if the policy guards pass (seals an operator ring)")
    pt.set_defaults(func=cmd_train)
    ps = sub.add_parser("status", parents=[common], help="active lens, space, holdout evals")
    ps.set_defaults(func=cmd_status)
    pr = sub.add_parser("rollback", parents=[common], help="revert to the previous sealed lens operator")
    pr.set_defaults(func=cmd_rollback)
    pm = sub.add_parser("sim", parents=[common], help="compare base vs lens cosine for two strings")
    pm.add_argument("a")
    pm.add_argument("b")
    pm.set_defaults(func=cmd_sim)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
