#!/usr/bin/env python3
"""Watchdog - harness-neutral enforcement adapter (v3.14).

FINDING: enforcement was single-harness-hook-shaped; on other harnesses the
"mandatory" loop was only as strong as the system prompt. This adapter needs
NO lifecycle hooks: run it as a cron job, systemd timer, or background loop
on ANY harness. It watches the chain head; if turns are being marked but not
sealed (the wear gap), it records adherence violations and can emit a nudge
file the harness prompt layer picks up.

    watchdog.py check                 # one-shot: is the marked turn sealed?
    watchdog.py loop --interval 300   # persistent watcher (Ctrl-C to stop)
    watchdog.py status                # last check result + wear trend

Stdlib only. Builds on enforce.py state + telemetry.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

import telemetry as telem


def _head(root: Path) -> int:
    p = root / "chain" / "rings.jsonl"
    if not p.exists():
        return -1
    with p.open() as fh:
        return sum(1 for line in fh if line.strip()) - 1


def _state_path(root: Path) -> Path:
    return root / "chain" / "watchdog.json"


def check(root: Path, nudge_file=None) -> dict:
    """Compare chain head now vs last check. If an enforce.py mark exists that    is newer than the last sealed ring, the turn is un-sealed: record it and
    optionally write a nudge file for the harness prompt layer."""
    root = Path(root)
    st = {}
    sp = _state_path(root)
    if sp.exists():
        try:
            st = json.loads(sp.read_text())
        except Exception:
            st = {}
    head = _head(root)
    # enforce.py records turn_head at mark time
    est = {}
    ep = root / "chain" / ".enforce.json"
    if ep.exists():
        try:
            est = json.loads(ep.read_text())
        except Exception:
            est = {}
    marked = est.get("turn_head")
    unsealed = marked is not None and head <= int(marked)
    result = {"head": head, "marked_head": marked, "unsealed_turn": bool(unsealed),
              "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
    if unsealed:
        try:
            telem.record(str(root), "adherence_nudge", {"source": "watchdog"})
        except Exception:
            pass
        if nudge_file:
            Path(nudge_file).write_text(
                "[Cypher Tempre watchdog] The current turn has not sealed a ring. "
                "Run: python3 " + str(SKILL_DIR / "recall.py") +
                ' turn "<thought>" --input "<request>"')
    elif nudge_file and Path(nudge_file).exists():
        try:
            Path(nudge_file).unlink()
        except Exception:
            pass
    st["last"] = result
    st["checks"] = int(st.get("checks", 0)) + 1
    st["unsealed_seen"] = int(st.get("unsealed_seen", 0)) + (1 if unsealed else 0)
    sp.write_text(json.dumps(st))
    return result


def cmd_check(args):
    r = check(args.root, nudge_file=args.nudge_file)
    print(("UNSEALED turn detected - nudge recorded" if r["unsealed_turn"]
           else "sealed / no marked turn pending")
          + f"  (head {r['head']}, marked {r['marked_head']})")


def cmd_loop(args):
    print(f"watchdog: checking every {args.interval}s (Ctrl-C to stop)")
    while True:
        cmd_check(args)
        time.sleep(args.interval)


def cmd_status(args):
    sp = _state_path(Path(args.root))
    if not sp.exists():
        print("no watchdog state yet - run: python3 watchdog.py check")
        return
    st = json.loads(sp.read_text())
    last = st.get("last") or {}
    print(f"checks: {st.get('checks', 0)}   unsealed seen: {st.get('unsealed_seen', 0)}")
    print(f"last: {last.get('ts')}  head {last.get('head')}  "
          f"unsealed={last.get('unsealed_turn')}")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=SKILL_DIR)
    common.add_argument("--nudge-file", default=None)
    ap = argparse.ArgumentParser(description="Harness-neutral enforcement watchdog",
                                 parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    pc = sub.add_parser("check", parents=[common]); pc.set_defaults(func=cmd_check)
    pl = sub.add_parser("loop", parents=[common])
    pl.add_argument("--interval", type=int, default=300)
    pl.set_defaults(func=cmd_loop)
    ps = sub.add_parser("status", parents=[common]); ps.set_defaults(func=cmd_status)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
