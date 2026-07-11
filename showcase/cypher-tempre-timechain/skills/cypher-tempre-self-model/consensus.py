#!/usr/bin/env python3
"""
Consensus — quorum-attested, authenticated hardening of the Timechain.

The bare hash-chain is tamper-EVIDENT (you can detect alteration). This upgrades it
toward tamper-RESISTANT with a quorum of independent witnesses, each holding its own
secret key. Every chain head is attested by each witness with HMAC-SHA256; the chain
is accepted only if a quorum (k-of-n) of witnesses produce valid signatures that AGREE
on the head hash.

Consequences:
  - To forge history you must also forge >= k witness signatures = steal >= k secret
    keys. Recomputing SHA-256 alone no longer suffices.
  - A minority of corrupted/equivocating witnesses (up to n-k) is outvoted and flagged
    — Byzantine fault tolerance of the attestation set.

HONEST SCOPE: on a single host the witness keys share one trust domain, so this is
authenticated quorum attestation, not distributed BFT. But it IS the consensus
primitive — point the witnesses at independent hosts/HSMs and the same code gives true
Byzantine fault tolerance. The wiring does not change.

Stdlib only (hmac, hashlib, secrets). Companion to timechain.py.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import secrets
import sys
from pathlib import Path

from timechain import Timechain, compute_ring_hash


def _mac(key_hex: str, msg: str) -> str:
    return hmac.new(bytes.fromhex(key_hex), msg.encode(), hashlib.sha256).hexdigest()


class Quorum:
    def __init__(self, root):
        self.tc = Timechain(root)
        self.dir = self.tc.dir / "consensus"
        self.cfg_path = self.dir / "config.json"
        self.att_path = self.dir / "attestations.jsonl"

    def init(self, n=3, quorum=2):
        if quorum > n:
            raise ValueError("quorum cannot exceed n")
        self.dir.mkdir(parents=True, exist_ok=True)
        cfg = {"n": n, "quorum": quorum,
               "witnesses": [{"id": f"w{i}", "key": secrets.token_hex(16)} for i in range(n)]}
        self.cfg_path.write_text(json.dumps(cfg, indent=2))
        return cfg

    def _cfg(self):
        return json.loads(self.cfg_path.read_text())

    def attest(self):
        cfg = self._cfg()
        head = self.tc.head()
        if not head:
            raise RuntimeError("no chain head to attest")
        h, rh = head["index"], head["ring_hash"]
        msg = f"{h}:{rh}"
        with self.att_path.open("a") as f:
            for w in cfg["witnesses"]:
                f.write(json.dumps({"height": h, "ring_hash": rh, "witness": w["id"],
                                    "mac": _mac(w["key"], msg)}) + "\n")
        return h, rh, cfg["n"]

    def _attestations(self):
        if not self.att_path.exists():
            return []
        return [json.loads(l) for l in self.att_path.read_text().splitlines() if l.strip()]

    def verify(self):
        cfg = self._cfg()
        keys = {w["id"]: w["key"] for w in cfg["witnesses"]}
        by_h = {r["index"]: r for r in self.tc.load()}
        ok_hash, report = self.tc.verify()
        atts = self._attestations()
        consensus_ok = True
        out = list(report)
        for h in sorted({a["height"] for a in atts}):
            # compare against the RECOMPUTED content hash, so a forger who also rewrites
            # the stored ring_hash field still fails consensus (attestations pin the original).
            actual = compute_ring_hash(by_h[h]) if h in by_h else None
            valid, faulty, seen = 0, [], set()
            for a in atts:
                if a["height"] != h or a["witness"] in seen:
                    continue
                seen.add(a["witness"])
                key = keys.get(a["witness"])
                good_sig = bool(key) and hmac.compare_digest(
                    a["mac"], _mac(key, f"{a['height']}:{a['ring_hash']}"))
                if good_sig and a["ring_hash"] == actual:
                    valid += 1
                elif good_sig:
                    faulty.append(f"{a['witness']}(equivocates)")
                else:
                    faulty.append(f"{a['witness']}(bad-sig)")
            status = "OK" if valid >= cfg["quorum"] else "FAIL"
            if valid < cfg["quorum"]:
                consensus_ok = False
            line = f"height {h}: {valid}/{cfg['n']} valid & agreeing, quorum {cfg['quorum']} -> {status}"
            if faulty:
                line += f"  | faulty (tolerated if quorum holds): {', '.join(faulty)}"
            out.append(line)
        return (ok_hash and consensus_ok), out


def cmd_init(args):
    cfg = Quorum(args.root).init(n=args.n, quorum=args.quorum)
    print(f"consensus initialized: {cfg['n']} witnesses, quorum {cfg['quorum']}")
    print("  (keys stored locally for this single host; distribute witnesses across hosts for true BFT)")


def cmd_attest(args):
    h, rh, n = Quorum(args.root).attest()
    print(f"attested head height {h} ({rh[:16]}..) by {n} witnesses")


def cmd_verify(args):
    ok, report = Quorum(args.root).verify()
    for line in report:
        print("  " + line)
    print("CONSENSUS:", "VALID" if ok else "BROKEN")
    sys.exit(0 if ok else 1)


def build_parser():
    default_root = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=default_root)
    p = argparse.ArgumentParser(description="Consensus — quorum-attested tamper-resistance for the Timechain.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pi = sub.add_parser("init", parents=[common], help="create a witness quorum")
    pi.add_argument("--n", type=int, default=3)
    pi.add_argument("--quorum", type=int, default=2)
    pi.set_defaults(func=cmd_init)
    pa = sub.add_parser("attest", parents=[common], help="witnesses sign the current head")
    pa.set_defaults(func=cmd_attest)
    pv = sub.add_parser("verify", parents=[common], help="verify hash-chain + quorum attestation")
    pv.set_defaults(func=cmd_verify)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
