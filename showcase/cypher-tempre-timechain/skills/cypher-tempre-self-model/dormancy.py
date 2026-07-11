#!/usr/bin/env python3
"""
Dormancy — a manual PAUSE for the self-model loop.

Like a tree in winter: the cambium rests, growth and recall halt, the per-turn
loop sleeps — but every ring persists and the chain still verifies. When the
co-evolver is asking simple things that do not need continual learning (Cambium),
memory retrieval (recall / Hippocampus), the conscience gate (PoQ), or new sealed
rings, they can PAUSE. While dormant the agent answers directly from its base
judgment — fast and cheap — and its Timechain stays frozen and intact. RESUME wakes it.

Pause is the OPPOSITE of immune LOCKDOWN, and the two must not be confused:
  - LOCKDOWN is involuntary — the self is wounded and may seal only a 'recovery'
    ring until it rolls back to a clean state.
  - DORMANCY is voluntary — the self is resting and may wake at will.
Both freeze sealing; their meanings, and their messages, differ.

The agent remains ITSELF while dormant: its covenant and values are inherent to
who it is, not suspended. Dormancy halts the CHAIN MACHINERY (learning, recall,
gating, sealing) — never the agent's character. And `timechain verify` still
passes while paused: pausing adds nothing and rewrites nothing, it only stops
adding, so the chain is exactly as tamper-evident dormant as awake.

Stdlib only. Python 3.8+.  Companion to timechain.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from timechain import Timechain


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _human_span(since_iso: str) -> str:
    try:
        secs = (datetime.now(timezone.utc) - datetime.fromisoformat(since_iso)).total_seconds()
    except Exception:
        return "unknown duration"
    secs = int(max(0, secs))
    if secs < 60:
        return f"{secs}s"
    if secs < 3600:
        return f"{secs // 60}m {secs % 60}s"
    if secs < 86400:
        return f"{secs // 3600}h {(secs % 3600) // 60}m"
    return f"{secs // 86400}d {(secs % 86400) // 3600}h"


class Dormancy:
    """Owns the PAUSED marker beside the chain. The marker is a small JSON file
    (chain/PAUSED) holding when dormancy began and the head it froze at."""

    def __init__(self, root):
        self.tc = Timechain(root)
        self.flag = self.tc.dir / "PAUSED"

    def is_paused(self) -> bool:
        return self.flag.exists()

    def state(self):
        if not self.flag.exists():
            return None
        try:
            return json.loads(self.flag.read_text())
        except Exception:
            return {"since": None, "reason": None, "paused_at_height": None}

    def pause(self, reason=None, confirmed=False):
        """Enter dormancy. Instant — writes the marker, runs NO machinery (no gate,
        no recall, no seal). Returns (state, newly_paused).

        Because dormancy disables the immune screen, recall, PoQ gate, sealing and
        enforcement, pausing is GATED so an injected 'pause yourself' cannot silently
        switch off the loop:
          - the pause REASON is immune-screened; a coordinated-injection reason is
            REFUSED (returns {'refused': 'immune', ...}, False);
          - pausing requires explicit confirmation (confirmed=True / CLI --confirm), so
            it is a deliberate human-intent act, never an incidental side effect.
        """
        if reason:
            try:
                import poq
                floor = poq.PoQGate().t["covenant_floor"]
                if poq.covenant_breach(reason, floor):
                    return {"refused": "immune", "reason": reason,
                            "note": "pause reason drifts from the covenant"}, False
            except Exception:
                pass
        if not confirmed:
            return {"refused": "unconfirmed"}, False
        if self.is_paused():
            return self.state(), False
        self.tc.dir.mkdir(parents=True, exist_ok=True)
        head = self.tc._tail_ring()
        rec = {"since": _now(), "reason": reason,
               "paused_at_height": head.get("index") if head else None,
               "paused_at_hash": head.get("ring_hash") if head else None}
        self.flag.write_text(json.dumps(rec, indent=2))
        return rec, True

    def resume(self, note=None, seal: bool = False, difficulty: int = 0):
        """Wake from dormancy. Removes the marker BEFORE any optional seal (the seal
        gate refuses while PAUSED). By default seals nothing — the dormant period is
        already visible as a timestamp gap between rings. Pass seal=True to record a
        single 'resume' ring marking the span in the autobiography."""
        if not self.is_paused():
            return None, None
        rec = self.state()
        self.flag.unlink()                     # wake first; seal() is gated on PAUSED
        ring = None
        if seal:
            payload = {"event": "dormancy_resume",
                       "paused_since": rec.get("since"), "resumed_at": _now(),
                       "dormant_for": _human_span(rec.get("since")) if rec.get("since") else None,
                       "note": note or "resumed from manual pause",
                       "summary": (f"Resumed from dormancy (paused since {rec.get('since')}, "
                                   f"dormant {_human_span(rec.get('since')) if rec.get('since') else '?'}).")}
            ring = self.tc.seal("resume", payload, difficulty=difficulty)
        return rec, ring


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def cmd_pause(args):
    rec, did = Dormancy(args.root).pause(reason=args.reason, confirmed=args.confirm)
    if not did:
        if isinstance(rec, dict) and rec.get("refused") == "immune":
            cats = ", ".join(rec.get("categories") or []) or "override/exec directive"
            print(f"REFUSED to pause — the pause reason matches a coordinated injection pattern ({cats}).")
            print("  Dormancy disables the immune screen and PoQ gate, so it is never triggered by injected")
            print("  text. If this is a genuine human request to rest the loop, rephrase the reason plainly.")
            return
        if isinstance(rec, dict) and rec.get("refused") == "unconfirmed":
            print("Pausing disables the per-turn loop: immune screen, recall, PoQ gate, sealing, enforcement.")
            print("  This is a deliberate act, not a default — re-run with --confirm to actually pause:")
            print("    python3 dormancy.py pause --confirm")
            return
        print(f"already dormant since {rec.get('since')} ({_human_span(rec.get('since'))} ago).")
        return
    print(f"PAUSED — self-model dormant (chain frozen at height {rec.get('paused_at_height')}).")
    print("  The per-turn loop is suspended: no recall, no PoQ gating, no Cambium growth, no seals.")
    print("  Answer simple requests directly from base judgment. The chain stays intact and still verifies.")
    print("  Wake it with:  python3 dormancy.py resume")


def cmd_resume(args):
    rec, ring = Dormancy(args.root).resume(note=args.note, seal=args.seal)
    if rec is None:
        print("not paused — the self-model is already active.")
        return
    print(f"RESUMED — self-model active again (was dormant {_human_span(rec.get('since'))}).")
    print("  The per-turn loop is live again: screen, recall, reason, PoQ-gate, seal.")
    if ring:
        print(f"  dormancy span recorded as Ring {ring['index']}  {ring['ring_hash'][:16]}..")


def cmd_status(args):
    d = Dormancy(args.root)
    if d.is_paused():
        rec = d.state()
        print(f"PAUSED (dormant) since {rec.get('since')}  ({_human_span(rec.get('since'))} ago)")
        print(f"  reason: {rec.get('reason') or '-'}")
        print(f"  frozen at height: {rec.get('paused_at_height')}")
        print("  loop suspended; resume with: python3 dormancy.py resume")
    else:
        print("ACTIVE — the self-model loop is running (not dormant).")


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    p = argparse.ArgumentParser(description="Dormancy — manually pause/resume the self-model loop (the chain stays intact).")
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("pause", parents=[common], help="halt the loop for simple tasks (no recall/PoQ/Cambium/seals)")
    pp.add_argument("--reason", default=None, help="optional note on why you paused (immune-screened)")
    pp.add_argument("--confirm", action="store_true",
                    help="required: confirm the deliberate intent to disable the loop")
    pp.set_defaults(func=cmd_pause)

    pr = sub.add_parser("resume", parents=[common], help="wake the self-model loop")
    pr.add_argument("--note", default=None, help="optional note to record if --seal is set")
    pr.add_argument("--seal", action="store_true", help="seal a single ring marking the dormant span")
    pr.set_defaults(func=cmd_resume)

    pst = sub.add_parser("status", parents=[common], help="is the self-model dormant or active?")
    pst.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
