#!/usr/bin/env python3
"""
Bench — sealed, repeatable retrieval baselines. Measure first, then improve.

Every learner the v3 design adds (trained scorer, projection head, distilled
labeler) must prove itself against a NOTARIZED starting point, or "improvement"
is vibes. This module generates retrieval probes from a chain's own blocks, runs
them through recall's full retrieval path, and reports hit-rate@k / MRR / timing
— then optionally seals the report as a `bench` ring, making the baseline (and
every later claim of beating it) falsifiable by anyone who re-runs the eval.

PROBE KINDS (auto-generated, deterministic under --seed):
  verbatim   a contiguous span lifted from the block — the floor; if this misses,
             retrieval is broken, not weak.
  degraded   a span with the block's own distinctive handles (sealed keyword +
             entity labels) REMOVED — measures recall beyond exact-keyword echo,
             the direction paraphrase robustness lives in. Honest limit: stdlib
             cannot synthesize true paraphrase; for that, supply hand-written
             gold probes via --pairs-file (the model writes them well).
  keywords   the block's sealed labels, shuffled — measures label-based recall
             (what the Hippocampus and the index map actually key on).

SCORING: a probe hits if its source ring returns in the top k (rank recorded for
MRR). For source-code chains, a same-file chunk counts as a path-credit hit —
retrieving the neighbouring chunk of the right file is success, not failure.
Zero-return probes (appetite said "no need") are counted separately: appetite is
part of the system under test, and hiding its misses would flatter the score.

HYGIENE: telemetry is SUPPRESSED while bench runs. Synthetic probes must never
contaminate the training log — a retriever trained on its own benchmark is the
exact closed-loop bias the hygiene rules exist to prevent.

Stdlib only. Python 3.8+. Builds on timechain.py, recall.py, embed.py.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

from timechain import Timechain
import recall as recallmod
import embed as embmod

BENCH_VERSION = 1

# Rings that are measurement/bookkeeping artifacts, not memories worth probing.
SKIP_RING_TYPES = {"genesis", "bench", "telemetry-digest", "quarantine", "recovery"}


def _eligible_rings(rings, after=0):
    out = []
    for r in rings:
        if r.get("index", 0) <= after or r.get("ring_type") in SKIP_RING_TYPES:
            continue
        if len(recallmod.block_text(r).split()) >= 12:
            out.append(r)
    return out


def make_probes(root, registry_root=None, sample=50, seed=1729, after=0,
                kinds=("verbatim", "degraded", "keywords")):
    """Generate deterministic probes from a chain's own blocks. Returns a list of
    {query, target_index, target_path, kind} dicts."""
    rec = recallmod.Recall(root, registry_root)
    rng = random.Random(seed)
    rings = _eligible_rings(rec.tc.load(), after=after)
    if len(rings) > sample:
        rings = rng.sample(rings, sample)
    probes = []
    for r in sorted(rings, key=lambda x: x["index"]):
        text = recallmod.block_text(r)
        words = text.split()
        lab = rec.block_labels(r)
        target = {"target_index": r["index"], "target_path": recallmod.ring_path(r)}
        if "verbatim" in kinds and len(words) >= 24:
            start = len(words) // 3
            probes.append({"query": " ".join(words[start:start + 12]),
                           "kind": "verbatim", **target})
        if "degraded" in kinds and len(words) >= 24:
            start = len(words) // 3
            handles = {str(t).lower() for t in (lab.get("keywords") or [])}
            handles |= {str(t).lower() for t in (lab.get("entities") or [])}
            kept = [w for w in words[start:start + 18]
                    if w.lower().strip(".,;:()[]{}\"'") not in handles]
            if len(kept) >= 6:
                probes.append({"query": " ".join(kept), "kind": "degraded", **target})
        if "keywords" in kinds:
            terms = list(dict.fromkeys((lab.get("keywords") or [])[:6]
                                       + (lab.get("entities") or [])[:4]))
            if len(terms) >= 3:
                rng.shuffle(terms)
                probes.append({"query": " ".join(str(t) for t in terms),
                               "kind": "keywords", **target})
    return probes


def _rank_of(blocks, target_index, target_path, path_credit=True):
    """1-based rank of the target among returned blocks; same-file chunks count
    when path_credit (retrieving the right file's neighbour chunk is success)."""
    for pos, b in enumerate(blocks, start=1):
        if b["index"] == target_index:
            return pos, "exact"
    if path_credit and target_path:
        for pos, b in enumerate(blocks, start=1):
            if (b.get("location") or {}).get("relative_path") == target_path:
                return pos, "path"
    return None, None


def run_bench(root, registry_root=None, probes=None, k=5, embed=False,
              provider="hashing", path_credit=True, budget_tokens=4000, scorer="auto"):
    """Run probes through recall's retrieval and aggregate hit metrics. Telemetry
    is suppressed for the duration: benchmarks must not train the learners."""
    prev_telemetry = os.environ.get("CT_TELEMETRY")
    os.environ["CT_TELEMETRY"] = "off"
    try:
        rec = recallmod.Recall(root, registry_root,
                               embedder=(provider if embed else None))
        per_kind, times = {}, []
        zero_returns = 0
        for p in probes or []:
            stats = per_kind.setdefault(p.get("kind", "gold"),
                                        {"n": 0, "hit1": 0, "hitk": 0, "mrr": 0.0,
                                         "path_hits": 0})
            stats["n"] += 1
            t0 = time.time()
            r = rec.retrieve(p["query"], budget_tokens=budget_tokens, max_blocks=k,
                             embed=embed, neighbors=0, scorer=scorer)
            times.append(time.time() - t0)
            if not r["blocks"]:
                zero_returns += 1
                continue
            rank, how = _rank_of(r["blocks"], p.get("target_index"),
                                 p.get("target_path"), path_credit=path_credit)
            if rank is not None:
                stats["hit1"] += 1 if rank == 1 else 0
                stats["hitk"] += 1 if rank <= k else 0
                stats["mrr"] += 1.0 / rank
                stats["path_hits"] += 1 if how == "path" else 0
        for stats in per_kind.values():
            n = max(1, stats["n"])
            stats["hit_at_1"] = round(stats.pop("hit1") / n, 4)
            stats["hit_at_k"] = round(stats.pop("hitk") / n, 4)
            stats["mrr"] = round(stats["mrr"] / n, 4)
        total = sum(s["n"] for s in per_kind.values())
        overall = {
            "n": total,
            "hit_at_1": round(sum(s["hit_at_1"] * s["n"] for s in per_kind.values())
                              / max(1, total), 4),
            "hit_at_k": round(sum(s["hit_at_k"] * s["n"] for s in per_kind.values())
                              / max(1, total), 4),
            "mrr": round(sum(s["mrr"] * s["n"] for s in per_kind.values())
                         / max(1, total), 4),
        }
        tc = rec.tc
        head = tc._tail_ring()
        return {
            "bench_version": BENCH_VERSION,
            "chain": str(Path(root)),
            "height": head["index"] + 1 if head else 0,
            "head_index": head.get("index") if head else None,
            "head_hash": head.get("ring_hash") if head else None,
            "mode": ("embedding:" + embmod.fingerprint_of(rec.embedder)) if embed else "lexical",
            "scorer_version": (rec.scorer_version if scorer == "auto"
                               else recallmod.SCORER_VERSION + " (forced hand)"),
            "k": k, "path_credit": path_credit,
            "probes": total, "zero_returns": zero_returns,
            "by_kind": per_kind, "overall": overall,
            "secs_mean": round(sum(times) / max(1, len(times)), 4),
            "secs_max": round(max(times), 4) if times else 0.0,
        }
    finally:
        if prev_telemetry is None:
            os.environ.pop("CT_TELEMETRY", None)
        else:
            os.environ["CT_TELEMETRY"] = prev_telemetry


def seal_report(seal_root, report, note=""):
    """Notarize a bench report as a `bench` ring — the falsifiable baseline every
    later learner must beat. May seal into a DIFFERENT chain than the one benched
    (e.g. the identity chain sealing a baseline measured on a task chain)."""
    tc = Timechain(seal_root)
    o = report["overall"]
    summary = (f"Bench baseline [{report['mode']}] on {report['chain']} at height "
               f"{report['height']} (head #{report['head_index']}): hit@1 {o['hit_at_1']}, "
               f"hit@{report['k']} {o['hit_at_k']}, MRR {o['mrr']} over {report['probes']} "
               f"probes ({report['zero_returns']} zero-return), {report['secs_mean']}s/probe, "
               f"scorer {report['scorer_version']}." + (f" {note}" if note else ""))
    return tc.seal("bench", {"summary": summary, "bench": report})


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _print_report(report):
    print(f"bench [{report['mode']}] {report['chain']}")
    print(f"  chain height {report['height']} (head #{report['head_index']} "
          f"{(report['head_hash'] or '')[:12]}..)   scorer {report['scorer_version']}")
    print(f"  probes: {report['probes']}   k={report['k']}   "
          f"zero-return: {report['zero_returns']}   "
          f"{report['secs_mean']}s/probe (max {report['secs_max']}s)")
    for kind, s in sorted(report["by_kind"].items()):
        print(f"  {kind:<10} n={s['n']:<4} hit@1 {s['hit_at_1']:<7} "
              f"hit@{report['k']} {s['hit_at_k']:<7} mrr {s['mrr']:<7} "
              f"(path-credit hits: {s['path_hits']})")
    o = report["overall"]
    print(f"  OVERALL    n={o['n']:<4} hit@1 {o['hit_at_1']:<7} "
          f"hit@{report['k']} {o['hit_at_k']:<7} mrr {o['mrr']}")


def cmd_probes(args):
    probes = make_probes(args.root, args.registry_root, sample=args.sample,
                         seed=args.seed, after=args.after)
    for p in probes:
        print(f"#{p['target_index']:>4} [{p['kind']:<9}] {p['query'][:110]}")
    print(f"({len(probes)} probes)")


def cmd_run(args):
    if args.pairs_file:
        probes = json.loads(Path(args.pairs_file).read_text())
        for p in probes:
            p.setdefault("kind", "gold")
    else:
        probes = make_probes(args.root, args.registry_root, sample=args.sample,
                             seed=args.seed, after=args.after)
    if not probes:
        print("no probes could be generated (chain too small or all blocks skipped)")
        sys.exit(1)
    report = run_bench(args.root, args.registry_root, probes=probes, k=args.k,
                       embed=args.embed, provider=args.provider,
                       path_credit=not args.strict, scorer=args.scorer)
    if args.after:
        report["after"] = args.after
    _print_report(report)
    if args.json:
        print(json.dumps(report, indent=2))
    if args.seal:
        ring = seal_report(args.seal_root or args.root, report, note=args.note or "")
        print(f"sealed bench Ring {ring['index']}  {ring['ring_hash'][:16]}..  "
              f"(in {args.seal_root or args.root})")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root, help="chain to bench (read-only)")
    common.add_argument("--registry-root", type=Path, default=None)
    common.add_argument("--sample", type=int, default=50, help="max rings to derive probes from")
    common.add_argument("--seed", type=int, default=1729, help="deterministic probe sampling/shuffles")
    common.add_argument("--after", type=int, default=0,
                        help="only probe rings with index > N (temporal-split evaluation)")

    p = argparse.ArgumentParser(description="Bench — sealed, repeatable retrieval baselines.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("probes", parents=[common], help="show the probes that would run")
    pp.set_defaults(func=cmd_probes)

    pr = sub.add_parser("run", parents=[common], help="run the benchmark (optionally seal the report)")
    pr.add_argument("--k", type=int, default=5, help="hit@k cutoff (also max blocks retrieved)")
    pr.add_argument("--embed", action="store_true", help="bench the embedding retrieval path")
    pr.add_argument("--provider", default="hashing", help="embedder: hashing|st|openai|voyage")
    pr.add_argument("--strict", action="store_true", help="exact-ring hits only (no same-file path credit)")
    pr.add_argument("--scorer", choices=["auto", "hand"], default="auto",
                    help="auto = whatever operator is active; hand = force hand weights (A/B the learner)")
    pr.add_argument("--pairs-file", default=None,
                    help="JSON list of hand-written gold probes: [{query, target_index|target_path, kind?}]")
    pr.add_argument("--seal", action="store_true", help="seal the report as a `bench` ring")
    pr.add_argument("--seal-root", type=Path, default=None,
                    help="chain to seal the report into (default: the benched chain)")
    pr.add_argument("--note", default=None, help="short annotation sealed with the report")
    pr.add_argument("--json", action="store_true", help="also print the full JSON report")
    pr.set_defaults(func=cmd_run)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
