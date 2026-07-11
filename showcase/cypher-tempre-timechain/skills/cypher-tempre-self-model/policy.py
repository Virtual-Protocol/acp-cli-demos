#!/usr/bin/env python3
"""
Policy — the values layer's grip on the machinery: risk tolerances, exploration
rates, and adoption guards, set by covenant and co-evolver, never by training.

The v3 principle this enforces: every constant that encodes a judgment is either
COVENANT POLICY (lives here, may be edited by the co-evolver, may only ever
TIGHTEN the conscience) or a CALIBRATED QUANTITY (fit by the learner, but only
within the tolerances this file sets). Thresholds derive from data plus policy —
never from vibes, and never from data alone.

DESIGN:
  - Defaults live IN CODE, not in a shipped file, so upgrades can never clobber a
    user's edits (the grown.json lesson). `registry/policy.json` is created only
    when someone writes an override or the learner stores a calibration.
  - The COVENANT GUARD: `values.covenant_floor` and `values.consistency_floor`
    from the file are applied as max(default, user) — the values layer can demand
    a stricter conscience, but no edit (and no learner) can loosen it.
  - The learner writes ONLY into the "calibrated" subsections, atomically, and
    preserves every user-set key — calibration and policy co-exist in one file
    with a hard ownership boundary.

Stdlib only. Python 3.8+.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

POLICY_VERSION = 1

DEFAULT_POLICY = {
    "policy_version": POLICY_VERSION,
    # Values layer — the conscience's floors. May only ever TIGHTEN (see load_policy).
    "values": {
        "covenant_floor": 150,
        "consistency_floor": 120,
    },
    # ε-exploration: how often retrieval ADDS one below-top-k candidate to gather
    # counterfactuals (never displacing a top hit), and from how deep a pool.
    "exploration": {
        "epsilon": 0.05,
        "window": 20,
    },
    # Trained-scorer adoption guards: minimum labeled offers and the margin by
    # which the trained scorer must beat the hand weights on the temporal holdout.
    "scorer": {
        "min_events": 150,
        "switchover_margin": 0.01,
    },
    # Appetite-curve calibration guard.
    "appetite": {
        "min_events": 100,
    },
    # PoQ threshold calibration: how much falsification evidence is needed, and
    # the false-seal rate the covenant is willing to tolerate.
    "poq": {
        "min_events": 50,
        "target_false_seal_rate": 0.05,
        # coverage gate (V4 P1): minimum declared evidence rings for an
        # aggregate claim (a stated total/sum/count). Tightens upward only.
        "aggregate_min_terms": 2,
    },
    # Representation lens: adoption guards (pair volume + must-beat-base margin)
    # and the head geometry/optimizer the dream phase trains with.
    "lens": {
        "min_pairs": 80,
        "switchover_margin": 0.02,
        "d_out": 32,
        "epochs": 12,
        "lr": 0.05,
    },
    # Extractor — the distilled labeler: when the cheap labeler's confidence is
    # below route_confidence the text routes to the model (a teach opportunity);
    # the distilled labeler must beat the CHEAP one at matching model labels.
    "extractor": {
        "min_pairs": 40,
        "switchover_margin": 0.02,
        "route_confidence": 0.45,
        "top_k": 5,
    },
    # Label-space growth (dream-proposed Cambium sprouts): a cluster of recent
    # blocks that is tight in embedding space but incoherent in fired labels is
    # a missing category. Caps keep dreams from flooding the Dream Cache.
    "growth": {
        "window": 64,
        "min_cluster": 3,
        "min_intra_sim": 0.35,
        "max_label_agreement": 0.34,
        "max_proposals_per_dream": 2,
    },
    # Replay — the antecedent cache: the match score above which a sealed ring is
    # OFFERED as an existing answer (the model still confirms), the false-replay
    # rate the covenant tolerates (calibration places the threshold there), and
    # the self-fulfilling-replay guard: after this many consecutive accepts a
    # ring must be re-derived fresh before it may be replayed again.
    "replay": {
        "match_threshold": 0.55,
        "target_false_replay_rate": 0.10,
        "min_events": 30,
        "max_chain_depth": 3,
    },
}


def _policy_path(registry_root=None):
    root = Path(registry_root) if registry_root else Path(__file__).resolve().parent
    return root / "registry" / "policy.json"


def _deep_merge(base, override):
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_policy(registry_root=None):
    """Effective policy: defaults <- registry/policy.json, with the covenant guard
    applied (values floors may only rise above the defaults, never sink)."""
    p = _policy_path(registry_root)
    user = {}
    if p.exists():
        try:
            user = json.loads(p.read_text())
        except Exception:
            user = {}
    policy = _deep_merge(DEFAULT_POLICY, user)
    for floor in ("covenant_floor", "consistency_floor"):
        policy["values"][floor] = max(DEFAULT_POLICY["values"][floor],
                                      int(policy["values"].get(floor, 0)))
    return policy


def save_policy(policy, registry_root=None):
    """v3.14: persist the effective policy to registry/policy.json. Floors are
    re-guarded on save (they may only rise above defaults, mirroring load).
    Used by dream-time gate calibration; every adoption is also sealed as a
    calibration ring so policy drift is on the chain."""
    p = _policy_path(registry_root)
    out = dict(policy or {})
    vals = out.get("values") or {}
    for floor in ("covenant_floor", "consistency_floor"):
        vals[floor] = max(DEFAULT_POLICY["values"][floor], int(vals.get(floor, 0) or 0))
    out["values"] = vals
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    return p


def write_calibration(section, payload, registry_root=None):
    """The learner's ONLY write path: store `payload` under <section>.calibrated,
    preserving every user-set key in the file. Returns the stored payload."""
    p = _policy_path(registry_root)
    current = {}
    if p.exists():
        try:
            current = json.loads(p.read_text())
        except Exception:
            current = {}
    current.setdefault(section, {})["calibrated"] = payload
    current["policy_version"] = POLICY_VERSION
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(current, indent=2, ensure_ascii=False))
    tmp.replace(p)
    return payload


def cmd_show(args):
    policy = load_policy(args.registry_root)
    print(json.dumps(policy, indent=2))
    p = _policy_path(args.registry_root)
    print(f"\n(defaults in code; overrides file: {p} {'present' if p.exists() else 'absent'};"
          f" values floors can only tighten)")


def build_parser():
    p = argparse.ArgumentParser(description="Policy — covenant-set tolerances governing the learners.")
    sub = p.add_subparsers(dest="cmd", required=True)
    ps = sub.add_parser("show", help="effective policy (defaults + overrides + covenant guard)")
    ps.add_argument("--registry-root", type=Path, default=None)
    ps.set_defaults(func=cmd_show)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
