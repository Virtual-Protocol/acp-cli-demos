#!/usr/bin/env python3
"""Conjecture - the sanctioned speculation channel (v3.14).

Bold-but-ungrounded insights seal as 'conjecture' rings: exempt from grounding
requirements but MANDATORILY tracked. Every conjecture is eventually scored
confirmed / falsified / retired; the open register is surfaced by doctor so
speculation debt stays visible. Be interestingly wrong ON the record.

    conjecture.py pose "<claim>" [--test "<how to check it>"]
    conjecture.py score <ring_index> confirmed|falsified|retired [--evidence "..."]
    conjecture.py open

Stdlib only. Companion to timechain.py; consumed by doctor.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

from timechain import Timechain


def pose(root: Path, claim: str, test: str = "", due_ring: int = 0) -> dict:
    tc = Timechain(root)
    payload = {
        "summary": claim,
        "status": "open",
        "proposed_test": test or "(none stated - name one when scoring)",
    }
    # v3.15 due-ring: a speculation channel without mandatory settlement is just
    # a place to sound smart. A due_ring makes scoring an OBLIGATION: once the
    # chain head passes it, the conjecture is OVERDUE and the enforcement layer
    # injects a scoring demand exactly like a seal obligation.
    if due_ring:
        payload["due_ring"] = int(due_ring)
    ring = tc.seal("conjecture", payload)
    return ring


def score(root: Path, index: int, verdict: str, evidence: str = "") -> dict:
    tc = Timechain(root)
    target = None
    for r in tc.load():
        if r["index"] == index:
            target = r
            break
    if target is None or target.get("ring_type") != "conjecture":
        raise SystemExit(f"ring {index} is not a conjecture ring")
    ring = tc.seal("conjecture-score", {
        "summary": f"conjecture {index} scored {verdict.upper()}: "
                   f"{(target.get('payload') or {}).get('summary', '')[:120]}",
        "conjecture_ring": index,
        "verdict": verdict,
        "evidence": evidence[:500],
    })
    try:
        import telemetry as telem
        telem.record(str(root), "falsify" if verdict == "falsified" else "use",
                     {"conjecture": index, "verdict": verdict,
                      "sealed_ring": ring["index"]})
    except Exception:
        pass
    return ring


def open_register(root: Path) -> list:
    tc = Timechain(root)
    posed, scored, head = {}, set(), 0
    for r in tc.load():
        head = max(head, r.get("index", 0))
        if r.get("ring_type") == "conjecture":
            posed[r["index"]] = (r.get("payload") or {})
        elif r.get("ring_type") == "conjecture-score":
            scored.add((r.get("payload") or {}).get("conjecture_ring"))
    out = []
    for i, p in sorted(posed.items()):
        if i in scored:
            continue
        due = p.get("due_ring") or 0
        out.append({"ring": i, "claim": p.get("summary", "")[:160],
                    "test": p.get("proposed_test", "")[:120],
                    "due_ring": due,
                    "overdue": bool(due and head >= due)})
    return out


def overdue(root: Path) -> list:
    """Open conjectures whose due_ring the chain head has passed — these are
    scoring OBLIGATIONS, surfaced by enforce.py at session start and by doctor."""
    return [c for c in open_register(root) if c.get("overdue")]


def cmd_pose(args):
    r = pose(args.root, args.claim, args.test or "", due_ring=args.due_ring)
    print(f"conjecture sealed: Ring {r['index']}  {r['ring_hash'][:16]}..")
    print("  it is now ON the record - score it when evidence arrives:")
    print(f"  python3 conjecture.py score {r['index']} confirmed|falsified|retired")
    if args.due_ring:
        print(f"  DUE at ring {args.due_ring}: once the head passes it, scoring "
              f"becomes an obligation (enforce/doctor will demand a verdict)")


def cmd_score(args):
    r = score(args.root, args.index, args.verdict, args.evidence or "")
    print(f"scored: Ring {r['index']}  {r['ring_hash'][:16]}..")


def cmd_open(args):
    reg = open_register(args.root)
    if not reg:
        print("no open conjectures - speculation debt is zero")
        return
    print(f"{len(reg)} open conjecture(s) awaiting a verdict:")
    for c in reg:
        tag = "  ** OVERDUE **" if c.get("overdue") else (
            f"  (due ring {c['due_ring']})" if c.get("due_ring") else "")
        print(f"  #{c['ring']}: {c['claim']}{tag}")
        print(f"      test: {c['test']}")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=SKILL_DIR)
    ap = argparse.ArgumentParser(description="Sanctioned speculation channel",
                                 parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    pp = sub.add_parser("pose", parents=[common])
    pp.add_argument("claim")
    pp.add_argument("--test", default="")
    pp.add_argument("--due-ring", type=int, default=0,
                    help="chain height at which scoring becomes an obligation")
    pp.set_defaults(func=cmd_pose)
    ps = sub.add_parser("score", parents=[common])
    ps.add_argument("index", type=int)
    ps.add_argument("verdict", choices=["confirmed", "falsified", "retired"])
    ps.add_argument("--evidence", default="")
    ps.set_defaults(func=cmd_score)
    po = sub.add_parser("open", parents=[common])
    po.set_defaults(func=cmd_open)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
