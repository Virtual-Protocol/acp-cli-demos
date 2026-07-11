#!/usr/bin/env python3
"""
Router — recall-first turn economics (v3.13).

DOCTRINE: wearing the skill is 100% and non-negotiable, and it must SAVE tokens,
not spend them. The model is the FALLBACK, not the default. Every turn routes
through this decision BEFORE any model reasoning:

    REPLAY   a sealed antecedent already answers this (replay.match above
             threshold) -> confirm it, seal a replay-grounded ring, spend ~zero
             model tokens on regeneration.
    PARTIAL  the chain holds substantial relevant context (hippocampus recall)
             but no full antecedent -> the model reasons ONLY over the missing
             delta; the found rings are the evidence base (--used-rings them).
    MODEL    novel ground: cambium detects a genuine faculty gap (dissonance
             above floor) or recall finds nothing usable -> full model
             reasoning is REQUIRED; growth may fire to cover the gap.

Usage (the first command of every turn):

    python3 router.py route "<the user's request>" [--context "..."] [--json]

Output: the decision, the evidence (antecedent ring / recalled rings / gap
report), and the exact next command to run. Telemetry logs every routing
decision so the savings are measurable (`python3 router.py stats`).

Stdlib only. Python 3.8+. Builds on replay.py, hippocampus.py, cambium.py,
telemetry.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

import telemetry as telem

# PARTIAL requires this much lexical relevance mass across recalled rings.
# v3.15: read THROUGH the calibrators registry — dream.calibrate_router owns
# these and adjusts them from route_regret evidence (bounded, sealed).
try:
    import calibrators as _cal
    PARTIAL_FLOOR = float(_cal.get("router.partial_floor", 0.35))
    PARTIAL_RINGS = int(_cal.get("router.partial_rings", 2))
except Exception:
    PARTIAL_FLOOR = 0.35      # top recalled ring score floor
    PARTIAL_RINGS = 2         # need at least this many related rings


def route(root: Path, query: str, context: str = "", top: int = 5) -> dict:
    root = Path(root)
    out = {"query": query[:200], "decision": None, "evidence": {}, "next": None}

    # ---- 1. REPLAY: does a sealed antecedent already answer this? ----------
    try:
        import replay
        eng = replay.Replay(root) if hasattr(replay, "Replay") else None
        if eng is not None:
            m = eng.match(query, context=context, top=top)
        else:
            m = replay.match(root, query, context=context, top=top)
        cands = m.get("candidates") or m.get("matches") or []
        thr = m.get("threshold") or 0.55
        best = cands[0] if cands else None
        if best and float(best.get("score", 0)) >= float(thr):
            out["decision"] = "REPLAY"
            out["evidence"]["antecedent"] = {
                "ring": best.get("index") or best.get("ring"),
                "score": best.get("score"),
                "summary": (best.get("summary") or "")[:200],
            }
            ring_id = best.get("index") or best.get("ring")
            out["next"] = (f"Confirm the antecedent answers the request, then: "
                           f"python3 replay.py accept --ring {ring_id} "
                           f"(or reject if it does not fit — rejects tune the threshold). "
                           f"Seal grounds on ring {ring_id}; do NOT regenerate the answer.")
            _log(root, out, thr)
            return out
        out["evidence"]["replay_best"] = ({"ring": best.get("index") or best.get("ring"),
                                           "score": best.get("score")} if best else None)
    except Exception as exc:
        out["evidence"]["replay_error"] = str(exc)[:120]

    # ---- 2. PARTIAL: does the chain hold substantial relevant context? -----
    recalled = []
    try:
        import hippocampus as hip
        hits = hip.Hippocampus(root).search(query, context=context)[:top]
        # search returns ring INDEXES (ints) or scored dicts depending on
        # version — normalize both, resolving summaries from the chain.
        idxs = []
        for h in hits:
            if isinstance(h, dict):
                recalled.append({"ring": h.get("index"),
                                 "score": round(float(h.get("score", 0)), 3),
                                 "summary": (h.get("summary") or h.get("text") or "")[:150]})
            else:
                idxs.append(int(h))
        if idxs:
            from timechain import Timechain
            from poq import tokens as _toks
            want = set(idxs)
            texts = {}
            for r in Timechain(root).load():
                if r["index"] in want:
                    p = r.get("payload") or {}
                    texts[r["index"]] = (p.get("summary") or p.get("objective")
                                         or p.get("function") or json.dumps(p)[:300])
            # REAL relevance: content-word overlap between query and ring text
            # (rank-based pseudo-scores made every stray hit look strong — the
            # v3.13 build test caught an interplanetary-protocol query routing
            # PARTIAL off junk hits).
            q = set(_toks(query))
            for i in idxs:
                t = set(_toks(texts.get(i, "")))
                score = (len(q & t) / len(q)) if q else 0.0
                recalled.append({"ring": i, "score": round(score, 3),
                                 "summary": (texts.get(i) or "")[:150]})
            recalled.sort(key=lambda r: r["score"], reverse=True)
    except Exception as exc:
        out["evidence"]["recall_error"] = str(exc)[:120]

    strong = [r for r in recalled if r["score"] >= PARTIAL_FLOOR]
    out["evidence"]["recalled"] = recalled

    # ---- 3. Gap check: does cambium flag a genuine faculty gap? ------------
    gap = None
    try:
        import cambium
        home = cambium.registry_home(root, None)
        gap = cambium.detect_gap(cambium.load_corpus(home), query, context)
        out["evidence"]["gap"] = {"dissonance": gap["dissonance"],
                                  "coverage": gap["coverage_ratio"],
                                  "uncovered": gap["uncovered"][:6]}
    except Exception as exc:
        out["evidence"]["gap_error"] = str(exc)[:120]

    # gap is only non-None when the `import cambium` above succeeded, so the
    # short-circuit keeps this NameError-safe without any dynamic import.
    gap_flagged = bool(gap and gap["dissonance"] > cambium.DISSONANCE_FLOOR)

    # Strong chain context wins: the model reasons only over the missing delta.
    # A gap flag alongside strong recall does not force full regeneration — the
    # gap describes NAMING coverage, not answer coverage; growth still fires in
    # the seal step. Gap forces MODEL only when recall is weak.
    if len(strong) >= PARTIAL_RINGS:
        out["decision"] = "PARTIAL"
        ids = [str(r["ring"]) for r in strong]
        gap_note = (" Cambium flags a gap — growth will fire on seal." if gap_flagged else "")
        out["next"] = (f"Fetch rings {', '.join(ids)} as the evidence base; reason ONLY "
                       f"over what they do not cover; seal with --used-rings {' '.join(ids)}. "
                       f"Do not re-derive what the rings already hold." + gap_note)
    else:
        out["decision"] = "MODEL"
        why = ("cambium flags a faculty gap (dissonance "
               f"{gap['dissonance']})" if gap_flagged else
               "no sealed antecedent and insufficient chain context")
        out["evidence"]["why_model"] = why
        out["next"] = ("Full model reasoning required (" + why + "). Run the loop: "
                       "python3 recall.py turn \"<thought>\" --input \"<request>\" — "
                       "growth will fire if the gap is genuine.")

    _log(root, out, None)
    return out


def _log(root, out, threshold):
    try:
        telem.record(str(root), "route_decision", {
            "decision": out["decision"],
            "replay_threshold": threshold,
            "n_recalled": len(out["evidence"].get("recalled") or []),
            "gap": (out["evidence"].get("gap") or {}).get("dissonance"),
        })
    except Exception:
        pass


def cmd_route(args):
    res = route(args.root, args.query, context=args.context or "", top=args.top)
    if args.json:
        print(json.dumps(res, indent=2))
        return
    print(f"ROUTE: {res['decision']}")
    ev = res["evidence"]
    if res["decision"] == "REPLAY":
        a = ev["antecedent"]
        print(f"  antecedent: ring {a['ring']} (score {a['score']})")
        print(f"  \"{a['summary']}\"")
    else:
        for r in (ev.get("recalled") or [])[:5]:
            print(f"  recalled #{r['ring']} ({r['score']}): {r['summary'][:90]}")
        if ev.get("gap"):
            g = ev["gap"]
            print(f"  gap: dissonance {g['dissonance']} coverage {g['coverage']} "
                  f"uncovered {g['uncovered']}")
    print(f"  NEXT: {res['next']}")


def regret(root: Path, decision_ring: int, verdict: str, why: str = "") -> dict:
    """v3.15: score a past routing decision so thresholds can LEARN.
    verdict: 'over-replay'  (REPLAY/PARTIAL chosen but the answer was wrong/stale
                             -> floor too low),
             'over-model'   (MODEL chosen but the chain had it -> floor too high),
             'good'         (decision was right — reinforces current thresholds)."""
    if verdict not in ("over-replay", "over-model", "good"):
        raise SystemExit("verdict must be over-replay|over-model|good")
    telem.record(str(root), "route_regret",
                 {"ring": decision_ring, "verdict": verdict, "why": why[:200]})
    return {"ring": decision_ring, "verdict": verdict}


def cmd_regret(args):
    r = regret(args.root, args.ring, args.verdict, args.why or "")
    print(f"regret recorded for routing at ring {r['ring']}: {r['verdict']} "
          f"(dream.calibrate_router learns from these)")


def cmd_stats(args):
    from collections import Counter
    c, n = Counter(), 0
    try:
        for _, e in telem.Telemetry(args.root).events():
            if e.get("event") == "route_decision":
                c[(e.get("data") or {}).get("decision", "?")] += 1
                n += 1
    except Exception:
        pass
    print(f"route decisions: {n}")
    for k, v in c.most_common():
        pct = (v / n * 100) if n else 0
        print(f"  {k:<8} {v}  ({pct:.0f}%)")
    if n:
        saved = c.get("REPLAY", 0) + c.get("PARTIAL", 0)
        print(f"  model-avoidance rate: {saved / n * 100:.0f}% "
              f"(REPLAY answered from chain; PARTIAL reasoned only the delta)")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=SKILL_DIR)
    ap = argparse.ArgumentParser(description="Recall-first turn router", parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("route", parents=[common], help="decide REPLAY | PARTIAL | MODEL for a request")
    pr.add_argument("query")
    pr.add_argument("--context", default="")
    pr.add_argument("--top", type=int, default=5)
    pr.add_argument("--json", action="store_true")
    pr.set_defaults(func=cmd_route)
    ps = sub.add_parser("stats", parents=[common], help="routing decision distribution + model-avoidance rate")
    ps.set_defaults(func=cmd_stats)
    pg = sub.add_parser("regret", parents=[common],
                        help="score a past route decision (over-replay|over-model|good) — evidence for threshold learning")
    pg.add_argument("ring", type=int)
    pg.add_argument("verdict", choices=["over-replay", "over-model", "good"])
    pg.add_argument("--why", default="")
    pg.set_defaults(func=cmd_regret)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
