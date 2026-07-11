#!/usr/bin/env python3
"""Autobiography - the living self-portrait (v3.14).

Ring 0 (static genesis covenant) is always loaded at session start, while the
rings of lived experience get lottery-ticket retrieval. Identity is behavioral
continuity - so synthesize a short, current self-portrait ring (what I have
learned, decided, gotten wrong, committed to) and surface it at session start
beside the covenant.

    autobiography.py synth [--text "..."]   # seal a fresh portrait
    autobiography.py show                    # print the latest portrait

The default synthesis is deterministic scaffolding (top faculties by
fire-rate, recent syntheses, open conjectures, at-risk claims, adherence);
pass --text for a model-authored portrait. Dream refreshes it when stale.
Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

from timechain import Timechain

STALE_AFTER = 200      # rings; dream re-synthesizes beyond this


def _scaffold(root: Path) -> str:
    tc = Timechain(root)
    fire = Counter()
    births, syntheses, prunes, at_risk = [], [], [], []
    head = 0
    for r in tc.load():
        head = r["index"]
        p = r.get("payload") or {}
        labels = p.get("labels") or {}
        for kind in ("senses", "modalities"):
            for f in labels.get(kind) or []:
                fire[f["name"]] += 1
        rt = r.get("ring_type")
        if rt == "promotion":
            births.append(p.get("summary") or "")
        elif rt == "synthesis":
            syntheses.append((r["index"], (p.get("summary") or "")[:140]))
        elif rt == "prune":
            prunes.append((p.get("summary") or "")[:120])
        if p.get("at_risk"):
            at_risk.extend([str(a)[:100] for a in p["at_risk"]])
    top = ", ".join(n for n, _ in fire.most_common(6))
    lines = [f"AUTOBIOGRAPHY (auto-scaffold at ring {head}).",
             f"Most-lived faculties: {top}."]
    if syntheses:
        lines.append("Recent syntheses: " + "; ".join(
            f"#{i}: {s}" for i, s in syntheses[-3:]))
    if prunes:
        lines.append("Recent pruning: " + "; ".join(prunes[-2:]))
    if at_risk:
        lines.append("Standing at-risk claims: " + "; ".join(at_risk[-4:]))
    try:
        import conjecture
        open_c = conjecture.open_register(root)
        if open_c:
            lines.append(f"Open conjectures ({len(open_c)}): " + "; ".join(
                f"#{c['ring']} {c['claim'][:80]}" for c in open_c[:3]))
    except Exception:
        pass
    try:
        import telemetry as telem
        tel = telem.Telemetry(root)
        a = tel.adherence()
        if a.get("wear_rate") is not None:
            lines.append(f"Honest wear rate: {a['wear_rate']*100:.0f}% "
                         f"(adherence {a['adherence_rate']*100:.1f}%"
                         + (f", accounted {a['accounted_rate']*100:.0f}%"
                            if a.get("accounted_rate") is not None else "")
                         + ").")
        # v3.15: the 7-day discipline SLOPE — an identity that can see itself decaying
        try:
            tr = tel.wear_trend()
            if tr.get("slope") is not None:
                direction = ("improving" if tr["slope"] > 0.005 else
                             "decaying" if tr["slope"] < -0.005 else "flat")
                lines.append(f"Discipline trend (7d): {direction}.")
        except Exception:
            pass
        # v3.15: routing economics — how often the chain answered instead of the model
        try:
            routes = Counter()
            for _, e in tel.events():
                if e.get("event") == "route_decision":
                    routes[(e.get("data") or {}).get("decision", "?")] += 1
            n = sum(routes.values())
            if n:
                avoid = (routes.get("REPLAY", 0) + routes.get("PARTIAL", 0)) / n
                lines.append(f"Recall-first economics: {avoid*100:.0f}% of {n} routed "
                             f"turns answered from the chain.")
        except Exception:
            pass
    except Exception:
        pass
    # v3.15: refuted beliefs are part of identity — the last conjecture scored
    # FALSIFIED is carried in the self-portrait (an identity that remembers being
    # wrong is the one that calibrates).
    try:
        last_refuted = None
        for r in tc.load():
            if r.get("ring_type") == "conjecture-score" and \
               (r.get("payload") or {}).get("verdict") == "falsified":
                last_refuted = (r.get("payload") or {}).get("summary", "")[:140]
        if last_refuted:
            lines.append(f"Last refuted belief: {last_refuted}")
    except Exception:
        pass
    # v3.15: top faculties by EFFECT (computed op contributions), not just label fires
    try:
        eff = Counter()
        for r in tc.load():
            comp = ((r.get("payload") or {}).get("labels") or {}).get("computed") or {}
            for nm in comp:
                eff[nm] += 1
        if eff:
            lines.append("Most-effectful faculties: " +
                         ", ".join(n for n, _ in eff.most_common(5)) + ".")
    except Exception:
        pass
    return " ".join(lines)


def latest(root: Path):
    tc = Timechain(root)
    last = None
    for r in tc.load():
        if r.get("ring_type") == "autobiography":
            last = r
    return last


def synth(root: Path, text: str = "") -> dict:
    tc = Timechain(root)
    body = text.strip() or _scaffold(root)
    return tc.seal("autobiography", {"summary": body,
                                     "authored": bool(text.strip())})


def is_stale(root: Path) -> bool:
    tc = Timechain(root)
    last, head = None, 0
    for r in tc.load():
        head = r["index"]
        if r.get("ring_type") == "autobiography":
            last = r["index"]
    return last is None or (head - last) > STALE_AFTER


def cmd_synth(args):
    r = synth(args.root, args.text or "")
    print(f"autobiography sealed: Ring {r['index']}  {r['ring_hash'][:16]}..")
    print((r["payload"]["summary"] or "")[:400])


def cmd_show(args):
    r = latest(args.root)
    if not r:
        print("no autobiography yet - run: python3 autobiography.py synth")
        return
    print(f"[Ring {r['index']} - {r['timestamp'][:19]}]")
    print(r["payload"]["summary"])


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=SKILL_DIR)
    ap = argparse.ArgumentParser(description="Living self-portrait",
                                 parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    py = sub.add_parser("synth", parents=[common])
    py.add_argument("--text", default="")
    py.set_defaults(func=cmd_synth)
    ps = sub.add_parser("show", parents=[common])
    ps.set_defaults(func=cmd_show)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
