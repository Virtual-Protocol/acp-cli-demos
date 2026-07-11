#!/usr/bin/env python3
"""
Registry Epochs — close the unauthenticated write surface (v3.12).

FINDING (2026-07-03 self-audit, Ring 1414): the registries (senses.json,
modalities.json, grown.json, grown_ops.json) are mutable files OUTSIDE the hash
chain. Only genesis snapshots them. A tampered grown_ops.json — which compiles
into executable ops the loop runs every turn — passed `timechain.py verify`
untouched. That is arbitrary-behavior injection under a verified-green banner.

FIX: every registry mutation seals a small `epoch` ring anchoring the
content-hash of each registry file into the chain (and the full content into
blockspace). Verification then recomputes the live registry hashes and compares
them against the latest epoch ring: a mismatch is TAMPERING, reported exactly
like a broken ring hash.

Commands:
    python3 epochs.py seal    [--root R]   # seal a new registry epoch ring now
    python3 epochs.py check   [--root R]   # live registries vs latest epoch
    python3 epochs.py status  [--root R]   # latest epoch summary

Library:
    seal_epoch(root, reason)   -> ring | None (no-op if hashes unchanged)
    check_epoch(root)          -> (ok: bool, report: [str])

Stdlib only. Python 3.8+. Fail-open on missing chain (a fresh install has no
epochs yet); fail-CLOSED on hash mismatch.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from timechain import Timechain

REGISTRY_FILES = ("senses.json", "modalities.json", "grown.json",
                  "grown_ops.json", "emergent.json")


def _registry_dir(root: Path) -> Path:
    return Path(root) / "registry"


def registry_hashes(root: Path) -> dict:
    """Stable content-hash per registry file (sha256 of canonical JSON when the
    file parses, of raw bytes otherwise, so a corrupted file still hashes)."""
    out = {}
    rdir = _registry_dir(root)
    for name in REGISTRY_FILES:
        p = rdir / name
        if not p.exists():
            out[name] = None
            continue
        raw = p.read_bytes()
        try:
            canon = json.dumps(json.loads(raw), sort_keys=True,
                               separators=(",", ":")).encode()
        except Exception:
            canon = raw
        out[name] = hashlib.sha256(canon).hexdigest()
    return out


def latest_epoch(tc: Timechain):
    """Newest epoch ring, or None. Streams backward-cheap: reads the file once."""
    latest = None
    for ring in tc.iter_rings() if hasattr(tc, "iter_rings") else _iter(tc):
        if ring.get("ring_type") == "epoch":
            latest = ring
    return latest


def _iter(tc: Timechain):
    path = tc.rings_path
    if not path.exists():
        return
    with path.open() as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    yield json.loads(line)
                except Exception:
                    continue


def seal_epoch(root: Path, reason: str = "registry mutation"):
    """Seal an epoch ring anchoring current registry hashes. No-op (returns
    None) when hashes are identical to the latest epoch — idempotent, so
    callers may invoke it after every growth event without chain spam."""
    root = Path(root)
    tc = Timechain(root)
    hashes = registry_hashes(root)
    prev = latest_epoch(tc)
    if prev and (prev.get("payload") or {}).get("registry_hashes") == hashes:
        return None
    files = [str(_registry_dir(root) / n) for n in REGISTRY_FILES
             if (_registry_dir(root) / n).exists()]
    return tc.seal("epoch", {
        "summary": f"registry epoch: {reason}",
        "registry_hashes": hashes,
    }, files=files)


def check_epoch(root: Path):
    """Compare live registry hashes against the latest sealed epoch.
    ok=True with a note when no epoch exists yet (pre-3.12 chain)."""
    root = Path(root)
    tc = Timechain(root)
    prev = latest_epoch(tc)
    if prev is None:
        return True, ["no registry epoch sealed yet (pre-3.12 chain) — "
                      "run: python3 epochs.py seal"]
    sealed = (prev.get("payload") or {}).get("registry_hashes") or {}
    live = registry_hashes(root)
    report, ok = [], True
    for name in REGISTRY_FILES:
        if sealed.get(name) != live.get(name):
            ok = False
            report.append(f"registry {name}: hash mismatch vs epoch ring "
                          f"{prev['index']} -> TAMPERED or unsealed mutation")
    if ok:
        report.append(f"registries match epoch ring {prev['index']} "
                      f"({prev['timestamp'][:19]})")
    return ok, report


def cmd_seal(args):
    ring = seal_epoch(args.root, reason=args.reason)
    if ring is None:
        print("no change — registries already match the latest epoch")
    else:
        print(f"sealed epoch Ring {ring['index']}  {ring['ring_hash'][:16]}..")


def cmd_check(args):
    ok, report = check_epoch(args.root)
    for line in report:
        print(("  " if ok else "  ! ") + line)
    print("EPOCH CHECK: PASS" if ok else "EPOCH CHECK: FAIL — registries do not "
          "match their sealed epoch. Treat as compromise: inspect, then reseal "
          "deliberately if the mutation was yours.")
    sys.exit(0 if ok else 1)


def cmd_status(args):
    tc = Timechain(Path(args.root))
    prev = latest_epoch(tc)
    if prev is None:
        print("no epoch rings yet")
        return
    h = (prev.get("payload") or {}).get("registry_hashes") or {}
    print(f"latest epoch: ring {prev['index']}  {prev['timestamp'][:19]}")
    for k, v in h.items():
        print(f"  {k:<18} {str(v)[:16]}")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", default=str(Path(__file__).parent))
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1], parents=[common])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seal", parents=[common]); s.add_argument("--reason", default="manual seal"); s.set_defaults(func=cmd_seal)
    c = sub.add_parser("check", parents=[common]); c.set_defaults(func=cmd_check)
    st = sub.add_parser("status", parents=[common]); st.set_defaults(func=cmd_status)
    args = ap.parse_args()
    args.root = Path(args.root)
    args.func(args)


if __name__ == "__main__":
    main()
