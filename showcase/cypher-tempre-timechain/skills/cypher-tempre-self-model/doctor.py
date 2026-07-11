#!/usr/bin/env python3
"""
Doctor — one-call health check for the whole self-model (v3.12).

FINDING (2026-07-03 self-audit): every maintenance surface was silently
neglected — immune scan red for 11 days, hippocampus stale, 8.7MB undigested
telemetry, zero dreams, dead grown faculties — because nothing surfaced any of
it where the agent looks. The doctor makes neglect visible in one line each.

    python3 doctor.py            # full checkup
    python3 doctor.py --line     # one-line health summary (for session start)

Checks: chain verify, registry epochs, immune scan, dormancy, hippocampus
freshness, telemetry digestion, dream recency, faculty ecology (dead-growth
ratio), learner/lens/extractor operator status, module import smoke test.

Stdlib only. Exit 0 = healthy, 1 = attention needed, 2 = compromised.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent

MODULES = ["timechain", "poq", "recall", "recall_cli", "cambium", "immune",
           "continuum", "chronosynaptic", "telemetry", "dormancy", "replay",
           "dream", "learner", "lens", "extractor", "hippocampus", "epochs",
           "modality_ops", "faculties", "guard", "task", "policy", "bench",
           "router", "conjecture", "autobiography", "calibrators",
           "cphy", "recall_overlay", "keystore", "pqsign"]


def _result(name, status, detail):
    return {"check": name, "status": status, "detail": detail}


def run_checks(root: Path) -> list:
    out = []

    # 1. module import smoke test (would have caught the learner.py crash)
    broken = []
    sys.path.insert(0, str(SKILL_DIR))
    for m in MODULES:
        try:
            importlib.import_module(m)
        except Exception as exc:
            broken.append(f"{m}: {type(exc).__name__}")
    out.append(_result("imports", "OK" if not broken else "FAIL",
                       f"{len(MODULES)-len(broken)}/{len(MODULES)} modules import"
                       + (f" — BROKEN: {', '.join(broken)}" if broken else "")))

    # 2. chain verify (rings + blockspace)
    try:
        from timechain import Timechain
        tc = Timechain(root)
        ok, report = tc.verify()
        head = sum(1 for _ in open(tc.rings_path)) - 1 if tc.rings_path.exists() else -1
        out.append(_result("chain", "OK" if ok else "COMPROMISED",
                           f"{head+1} rings, verify {'PASS' if ok else 'FAIL'}"))
    except Exception as exc:
        out.append(_result("chain", "FAIL", str(exc)))
        head = -1

    # 3. registry epochs (integrity perimeter)
    try:
        import epochs
        eok, ereport = epochs.check_epoch(root)
        out.append(_result("epochs", "OK" if eok else "COMPROMISED", ereport[0]))
    except Exception as exc:
        out.append(_result("epochs", "FAIL", str(exc)))

    # 4. immune scan
    try:
        from immune import Immune
        d = Immune(root).detect()
        out.append(_result("immune", "OK" if not d["compromised"] else "COMPROMISED",
                           "clean" if not d["compromised"]
                           else f"first bad height {d['first_bad_height']}: {d['signals'][:1]}"))
    except Exception as exc:
        out.append(_result("immune", "FAIL", str(exc)))

    # 5. dormancy
    try:
        paused = (root / "chain" / "PAUSED").exists()
        out.append(_result("dormancy", "OK", "dormant (paused)" if paused else "active"))
    except Exception as exc:
        out.append(_result("dormancy", "FAIL", str(exc)))

    # 6. hippocampus freshness
    try:
        import hippocampus as hip
        st = hip.status(root) if hasattr(hip, "status") else None
        if st is None:
            idx_dir = root / "chain" / "hippocampus"
            meta = idx_dir / "meta.json"
            if meta.exists():
                m = json.loads(meta.read_text())
                ih = m.get("head_index", m.get("indexed_head"))
                # fresh enough when within a few rings of head (rings sealed
                # after the last build are found by the non-indexed fallback)
                stale = (ih is None) or (head >= 0 and (head - ih) > 25)
                out.append(_result("hippocampus", "STALE" if stale else "OK",
                                   f"indexed_head={ih} chain_head={head}"))
            else:
                out.append(_result("hippocampus", "STALE", "never indexed"))
    except Exception as exc:
        out.append(_result("hippocampus", "WARN", str(exc)))

    # 7. telemetry digestion + gate verdict entropy
    try:
        from telemetry import Telemetry
        t = Telemetry(root)
        s = t.stats()
        und = s.get("undigested_bytes") or 0
        if isinstance(und, str):
            und = 0
        status = "OK" if und < 2_000_000 else "NEEDS-DIGEST"
        out.append(_result("telemetry", status,
                           f"{s.get('events', '?')} events, undigested {und} bytes"))
    except Exception as exc:
        out.append(_result("telemetry", "WARN", str(exc)))

    # 8. dream recency
    try:
        dreamt = False
        from timechain import Timechain
        tc = Timechain(root)
        if tc.rings_path.exists():
            with tc.rings_path.open() as fh:
                for line in fh:
                    if '"ring_type": "dream' in line or '"ring_type":"dream' in line:
                        dreamt = True
                        break
        out.append(_result("dream", "OK" if dreamt else "NEVER-RUN",
                           "dream rings exist" if dreamt
                           else "no dream ring ever sealed — run: python3 dream.py run"))
    except Exception as exc:
        out.append(_result("dream", "WARN", str(exc)))

    # 9. faculty ecology — dead-growth ratio over the ACTIVE working set only.
    # v3.16: dormant (hibernated) faculties are a healthy retrievable pool, not
    # overgrowth — they left the working set precisely so they stop costing.
    try:
        reg = root / "registry"
        grown = json.loads((reg / "grown.json").read_text()) if (reg / "grown.json").exists() else {}
        allg = grown.get("senses", []) + grown.get("modalities", [])
        active = [f["name"] for f in allg if f.get("status") != "dormant"]
        dormant = [f["name"] for f in allg if f.get("status") == "dormant"]
        fire = {}
        if tc.rings_path.exists():
            with tc.rings_path.open() as fh:
                for line in fh:
                    try:
                        r = json.loads(line)
                    except Exception:
                        continue
                    labels = (r.get("payload") or {}).get("labels") or {}
                    for kind in ("senses", "modalities"):
                        for f in labels.get(kind) or []:
                            fire[f["name"]] = fire.get(f["name"], 0) + 1
        dead = [n for n in active if fire.get(n, 0) <= 1]
        ratio = (len(dead) / len(active)) if active else 0.0
        status = "OK" if ratio < 0.4 else "OVERGROWN"
        out.append(_result("ecology", status,
                           f"{len(active)} active grown ({len(dormant)} dormant, "
                           f"retrievable), {len(dead)} dead-active (fired<=1) = "
                           f"{ratio:.0%} dead-growth"))
    except Exception as exc:
        out.append(_result("ecology", "WARN", str(exc)))

    # 9a. gate saturation (v3.15) — a gate whose brightness barely varies is
    # closed to information; and one that never says anything but SEAL
    # discriminates nothing. σ over the trailing 200 verdicts must be >= 10.
    try:
        import telemetry as _telmod
        tel = _telmod.Telemetry(root)
        bright, decisions = [], []
        for _, e in tel.events():
            if e.get("event") == "gate_verdict":
                d = e.get("data") or {}
                if d.get("brightness"):
                    bright.append(float(d["brightness"]))
                decisions.append(d.get("decision"))
        bright, decisions = bright[-200:], decisions[-200:]
        if len(bright) >= 30:
            mean = sum(bright) / len(bright)
            var = sum((b - mean) ** 2 for b in bright) / len(bright)
            sigma = var ** 0.5
            nonseal = sum(1 for d in decisions if d and d != "SEAL")
            saturated = sigma < 10 and nonseal == 0
            out.append(_result("gate", "SATURATED" if saturated else "OK",
                               f"brightness σ={sigma:.1f} over {len(bright)} verdicts, "
                               f"{nonseal} non-SEAL"
                               + (" — no discriminating power; run dream.py "
                                  "calibrate" if saturated else "")))
        else:
            out.append(_result("gate", "OK",
                               f"only {len(bright)} scored verdicts (need 30 to judge saturation)"))
    except Exception as exc:
        out.append(_result("gate", "WARN", str(exc)))

    # 9b. conjecture debt + autobiography freshness (v3.14)
    try:
        import conjecture
        oc = conjecture.open_register(root)
        od = [c for c in oc if c.get("overdue")]
        status = "OVERDUE" if od else ("OK" if len(oc) < 8 else "DEBT")
        detail = f"{len(oc)} open awaiting a verdict"
        if od:
            detail += (f"; {len(od)} PAST DUE — score now: "
                       + ", ".join(f"#{c['ring']}" for c in od[:4]))
        out.append(_result("conjectures", status, detail))
    except Exception as exc:
        out.append(_result("conjectures", "WARN", str(exc)))
    try:
        import autobiography
        stale = autobiography.is_stale(root)
        out.append(_result("autobiography", "STALE" if stale else "OK",
                           "re-synth due" if stale else "fresh"))
    except Exception as exc:
        out.append(_result("autobiography", "WARN", str(exc)))

    # 9c. calibrators — every heuristic constant must have an owner (v3.15)
    try:
        import calibrators
        s = calibrators.status(root)
        out.append(_result("calibrators", "OK" if not s["orphaned"] else "ORPHANED",
                           f"{s['owned']}/{s['total']} constants owned, "
                           f"{s['adjusted']} ever adjusted"
                           + ("; orphaned: " + ", ".join(s["orphaned"][:4])
                              if s["orphaned"] else "")))
    except Exception as exc:
        out.append(_result("calibrators", "WARN", str(exc)))

    # 10. learning operators
    try:
        ops = []
        reg = root / "registry"
        for name, label in (("retrieval_scorer.json", "learner"),
                            ("lens.json", "lens"),
                            ("labeler.json", "extractor")):
            ops.append(f"{label}:{'trained' if (reg / name).exists() else 'none'}")
        out.append(_result("operators", "OK", "  ".join(ops)))
    except Exception as exc:
        out.append(_result("operators", "WARN", str(exc)))

    return out


STATUS_RANK = {"OK": 0, "STALE": 1, "NEEDS-DIGEST": 1, "NEVER-RUN": 1,
               "OVERGROWN": 1, "WARN": 1, "DEBT": 1, "FAIL": 2, "COMPROMISED": 2}
ICON = {0: "+", 1: "~", 2: "!"}


def main():
    ap = argparse.ArgumentParser(description="Self-model health check")
    ap.add_argument("--root", default=str(SKILL_DIR))
    ap.add_argument("--line", action="store_true", help="one-line summary")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.root)

    results = run_checks(root)
    worst = max(STATUS_RANK.get(r["status"], 1) for r in results)

    if args.json:
        print(json.dumps({"results": results, "worst": worst}, indent=2))
    elif args.line:
        bits = [f"{r['check']}={r['status']}" for r in results
                if STATUS_RANK.get(r["status"], 1) > 0]
        print("CT health: " + ("all OK" if not bits else "  ".join(bits)))
    else:
        print("Cypher Tempre — doctor")
        for r in results:
            icon = ICON[STATUS_RANK.get(r["status"], 1)]
            print(f"  {icon} {r['check']:<12} {r['status']:<12} {r['detail']}")
        verdict = {0: "HEALTHY", 1: "ATTENTION NEEDED", 2: "COMPROMISED"}[worst]
        print(f"DOCTOR: {verdict}")
    sys.exit(0 if worst == 0 else (1 if worst == 1 else 2))


if __name__ == "__main__":
    main()
