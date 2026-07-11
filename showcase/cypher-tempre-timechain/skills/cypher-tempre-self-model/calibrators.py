#!/usr/bin/env python3
"""
Calibrators registry (v3.15) — every heuristic constant gets an OWNER.

The fourth self-audit's unifying finding: 12k+ telemetry events and almost none
of them change behavior — thresholds are hand-set and orphaned. This module is
the closed loop's spine:

  * a REGISTRY of tunable constants: name, module, current value, bounds,
    evidence stream (which telemetry events feed it), owner (which dream-cycle
    calibrator adjusts it), last adjustment
  * `calibrators.py status` — doctor-auditable: N constants owned / M orphaned
  * `get(name, default)` — modules read their constants THROUGH the registry so
    a calibrated value transparently overrides the hard-coded default
  * `adjust(name, new, why)` — bounded, sealed (a `calibration` ring), and
    telemetry-logged; refuses out-of-bounds moves

VALUES floors (covenant, consistency) are POLICY, not calibration — they may
only tighten and are never owned here (policy.py enforces that guard).

Stdlib only. Python 3.8+.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

REG_FILE = "calibrators.json"

# The canonical registry of tunables. `owner` names the dream-cycle routine
# that adjusts it; `events` is the telemetry evidence stream it learns from.
DEFAULTS = {
    "router.partial_floor": {
        "value": 0.35, "lo": 0.10, "hi": 0.80,
        "module": "router.py", "events": ["route_decision", "route_regret"],
        "owner": "dream.calibrate_router",
    },
    "router.partial_rings": {
        "value": 2, "lo": 1, "hi": 6,
        "module": "router.py", "events": ["route_decision", "route_regret"],
        "owner": "dream.calibrate_router",
    },
    "poq.brightness_target": {
        "value": 150, "lo": 120, "hi": 220,
        "module": "poq.py", "events": ["gate_verdict"],
        "owner": "dream.calibrate_gate",
    },
    "poq.entity_grounding_floor": {
        "value": 128, "lo": 64, "hi": 220,
        "module": "poq.py", "events": ["gate_verdict"],
        "owner": "dream.calibrate_gate",
    },
    "cambium.autogrow_min_salience": {
        "value": 170, "lo": 100, "hi": 255,
        "module": "cambium.py", "events": ["use"],
        "owner": "dream.calibrate_appetite",
    },
    "cambium.dissonance_floor": {
        "value": 150, "lo": 100, "hi": 230,
        "module": "cambium.py", "events": ["use"],
        "owner": "dream.calibrate_appetite",
    },
    "replay.threshold": {
        "value": 0.55, "lo": 0.30, "hi": 0.90,
        "module": "replay.py", "events": ["replay-accept", "replay-reject"],
        "owner": "learner.calibrate_appetite",
    },
    "enforce.max_nudges": {
        "value": 3, "lo": 1, "hi": 6,
        "module": "enforce.py", "events": ["adherence_nudge", "adherence_debt"],
        "owner": "dream.calibrate_governor",
    },
}


def _path(root: Path) -> Path:
    return Path(root) / "registry" / REG_FILE


def load(root: Path) -> dict:
    p = _path(root)
    reg = {}
    if p.exists():
        try:
            reg = json.loads(p.read_text())
        except Exception:
            reg = {}
    # merge: file values win, DEFAULTS supply anything new
    out = {k: dict(v) for k, v in DEFAULTS.items()}
    for k, v in reg.items():
        out.setdefault(k, {}).update(v)
    return out


def save(root: Path, reg: dict):
    p = _path(root)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(reg, indent=1, sort_keys=True))
    tmp.replace(p)


def get(name: str, default=None, root: Path = SKILL_DIR):
    """Read a constant THROUGH the registry — calibrated value overrides the
    hard-coded default. Never raises; unknown names return the default."""
    try:
        reg = load(root)
        if name in reg and "value" in reg[name]:
            return reg[name]["value"]
    except Exception:
        pass
    return default


def adjust(root: Path, name: str, new_value, why: str, seal: bool = True) -> dict:
    """Bounded, sealed, telemetry-logged adjustment. Refuses unknown constants
    and out-of-bounds moves — a calibrator can drift, never leap."""
    reg = load(root)
    if name not in reg:
        raise SystemExit(f"unknown calibrator constant: {name!r} (register it in DEFAULTS)")
    ent = reg[name]
    lo, hi = ent.get("lo"), ent.get("hi")
    val = type(ent["value"])(new_value)
    if lo is not None and val < lo or hi is not None and val > hi:
        raise SystemExit(f"{name}: {val} outside bounds [{lo}, {hi}] — refused")
    old = ent["value"]
    ent["value"] = val
    ent["last_adjustment"] = {"old": old, "new": val, "why": why[:300]}
    save(root, reg)
    try:
        import telemetry as telem
        telem.record(str(root), "calibration",
                     {"constant": name, "old": old, "new": val, "why": why[:200]})
    except Exception:
        pass
    if seal:
        try:
            from timechain import Timechain
            Timechain(root).seal("calibration", {
                "summary": f"calibrator adjustment: {name} {old} -> {val} ({why[:160]})",
                "constant": name, "old": old, "new": val})
        except Exception:
            pass
    return {"constant": name, "old": old, "new": val}


def status(root: Path) -> dict:
    """Doctor-auditable ownership census."""
    reg = load(root)
    owned = {k: v for k, v in reg.items() if v.get("owner")}
    adjusted = {k: v for k, v in reg.items() if v.get("last_adjustment")}
    return {"total": len(reg), "owned": len(owned),
            "orphaned": [k for k, v in reg.items() if not v.get("owner")],
            "adjusted": len(adjusted),
            "entries": reg}


def cmd_status(args):
    s = status(args.root)
    print(f"calibrators: {s['total']} constants, {s['owned']} owned, "
          f"{len(s['orphaned'])} orphaned, {s['adjusted']} ever adjusted")
    for k, v in sorted(s["entries"].items()):
        la = v.get("last_adjustment")
        tail = (f"  last: {la['old']}->{la['new']}" if la else "")
        print(f"  {k:<34} = {v['value']:<8} [{v.get('lo')},{v.get('hi')}] "
              f"owner={v.get('owner', 'NONE')}{tail}")


def cmd_adjust(args):
    r = adjust(args.root, args.name, args.value, args.why)
    print(f"adjusted {r['constant']}: {r['old']} -> {r['new']} (sealed)")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=SKILL_DIR)
    ap = argparse.ArgumentParser(
        description="Calibrators registry — every heuristic constant has an owner",
        parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    ps = sub.add_parser("status", parents=[common], help="ownership census (doctor-auditable)")
    ps.set_defaults(func=cmd_status)
    pa = sub.add_parser("adjust", parents=[common], help="bounded, sealed adjustment")
    pa.add_argument("name")
    pa.add_argument("value")
    pa.add_argument("--why", required=True)
    pa.set_defaults(func=cmd_adjust)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
