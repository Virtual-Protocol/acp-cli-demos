#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""pqsign — post-quantum hash-based signatures for agent attestations (stdlib).

The Timechain's INTEGRITY is already post-quantum: SHA-256 hash-linking only
weakens by Grover (256 -> 128-bit), so a rewrite is as infeasible for a quantum
adversary as for a classical one. What is NOT quantum-safe is any ECDSA
signature an agent might use to prove authorship to ANOTHER agent (OP4 pack
transfer, cross-agent verification) — secp256k1 falls to Shor. Base's L1 cannot
change here; but the agent's OWN attestations can be signed with a scheme that
needs no elliptic curve at all.

This organ is Lamport one-time signatures under a Merkle tree (a minimal
XMSS): security rests ENTIRELY on the preimage/collision resistance of a hash
function, which quantum computers do not break — they only Grover-halve it. So
a 256-bit hash gives 128-bit post-quantum security.

  keygen(height h)  -> 2^h one-time leaves under one Merkle root (the pubkey)
  sign(msg)         -> consumes the next unused leaf; refuses reuse (fatal to
                       Lamport security) by advancing a persisted index
  verify(msg,sig,root) -> checks the OTS then recomputes the root via auth path

Stateful by necessity: a Lamport leaf signed twice leaks the private key, so
the signing index is persisted and never rewound. Keep the state file.

Usage:
  python3 pqsign.py keygen --height 6 --out mykey.json    # 64 signatures
  python3 pqsign.py sign   --key mykey.json --msg "I attest ring 42"
  python3 pqsign.py verify --root <hex> --sig sig.json --msg "I attest ring 42"
  python3 pqsign.py selftest
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

H = hashlib.sha256
N = 32                      # hash / secret width in bytes
BITS = N * 8               # Lamport signs a 256-bit message digest


def _h(*parts: bytes) -> bytes:
    m = H()
    for p in parts:
        m.update(p)
    return m.digest()


# --------------------------------------------------------------------------- #
# Lamport one-time signatures
# --------------------------------------------------------------------------- #

def _leaf_keypair(seed: bytes, leaf: int) -> tuple:
    """Deterministically derive a leaf's Lamport private+public key from a
    master seed (so only the seed must be stored, not 2^h * 16 KB of keys)."""
    sk = [[_h(seed, leaf.to_bytes(4, "big"), bit.to_bytes(2, "big"),
              bytes([b])) for b in (0, 1)] for bit in range(BITS)]
    pk = [[_h(sk[bit][b]) for b in (0, 1)] for bit in range(BITS)]
    return sk, pk


def _leaf_pk_hash(pk) -> bytes:
    m = H()
    for pair in pk:
        m.update(pair[0]); m.update(pair[1])
    return m.digest()


def _bits(digest: bytes):
    for byte in digest:
        for i in range(8):
            yield (byte >> (7 - i)) & 1


def _ots_sign(sk, msg_digest: bytes) -> list:
    return [sk[i][bit] for i, bit in enumerate(_bits(msg_digest))]


# --------------------------------------------------------------------------- #
# Merkle tree over 2^height leaves
# --------------------------------------------------------------------------- #

def _merkle(leaves: list) -> list:
    """Return all levels bottom-up; levels[0] = leaves, levels[-1] = [root]."""
    levels = [leaves]
    while len(levels[-1]) > 1:
        cur = levels[-1]
        nxt = [_h(cur[i], cur[i + 1]) for i in range(0, len(cur), 2)]
        levels.append(nxt)
    return levels


def _auth_path(levels, index: int) -> list:
    path = []
    for level in levels[:-1]:
        sib = index ^ 1
        path.append(level[sib].hex())
        index >>= 1
    return path


def _root_from_path(leaf_hash: bytes, index: int, path: list) -> bytes:
    node = leaf_hash
    for sib_hex in path:
        sib = bytes.fromhex(sib_hex)
        node = _h(node, sib) if index % 2 == 0 else _h(sib, node)
        index >>= 1
    return node


def keygen(height: int, seed: bytes = None) -> dict:
    if not 0 < height <= 16:
        raise ValueError("height must be 1..16 (2..65536 signatures)")
    seed = seed or os.urandom(N)
    n = 1 << height
    leaf_hashes = [_leaf_pk_hash(_leaf_keypair(seed, i)[1]) for i in range(n)]
    levels = _merkle(leaf_hashes)
    return {"scheme": "lamport-merkle(sha256)", "height": height,
            "seed": seed.hex(), "root": levels[-1][0].hex(),
            "next_index": 0, "capacity": n}


def sign(key: dict, message: bytes) -> dict:
    """Sign with the next unused leaf. The signature carries, per message bit:
    the revealed secret half (ots) AND the OTHER pk half (public, not secret),
    so a verifier reconstructs the full leaf pk hash and anchors it in the root.
    ADVANCES the index — a Lamport leaf must never sign twice."""
    idx = key["next_index"]
    if idx >= key["capacity"]:
        raise RuntimeError("key exhausted — every one-time leaf is spent; keygen anew")
    seed = bytes.fromhex(key["seed"])
    sk, pk = _leaf_keypair(seed, idx)
    md = _h(message)
    ots, unrevealed = [], []
    for i, bit in enumerate(_bits(md)):
        ots.append(sk[i][bit].hex())
        unrevealed.append(pk[i][1 - bit].hex())     # the pk half NOT proven by ots
    n = key["capacity"]
    leaf_hashes = [_leaf_pk_hash(_leaf_keypair(seed, j)[1]) for j in range(n)]
    levels = _merkle(leaf_hashes)
    sig = {"index": idx, "ots": ots, "pk_unrevealed": unrevealed,
           "leaf_pk_hash": leaf_hashes[idx].hex(),
           "auth": _auth_path(levels, idx), "root": key["root"]}
    key["next_index"] = idx + 1           # ADVANCE — never sign a leaf twice
    return sig


def verify(root_hex: str, message: bytes, sig: dict) -> bool:
    return _verify_full(root_hex, _h(message), sig)


def _verify_full(root_hex: str, md: bytes, sig: dict) -> bool:
    # Reconstruct each bit's pk pair: revealed side = H(sig), unrevealed side is
    # carried in the signature (it is public — the pk, not the secret).
    pairs = sig["pk_unrevealed"]
    m = H()
    ok_ots = True
    for i, bit in enumerate(_bits(md)):
        revealed = _h(bytes.fromhex(sig["ots"][i]))
        other = bytes.fromhex(pairs[i])
        pair = (revealed, other) if bit == 0 else (other, revealed)
        m.update(pair[0]); m.update(pair[1])
    leaf_hash = m.digest()
    if leaf_hash.hex() != sig["leaf_pk_hash"]:
        ok_ots = False
    root = _root_from_path(leaf_hash, sig["index"], sig["auth"])
    return ok_ots and root.hex() == root_hex


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _load(p):
    return json.loads(Path(p).read_text())


def _save(p, d):
    Path(p).write_text(json.dumps(d, indent=1))


def cmd_keygen(a):
    key = keygen(a.height)
    _save(a.out, key)
    print(json.dumps({"root": key["root"], "capacity": key["capacity"],
                      "key_file": a.out,
                      "note": "KEEP the key file: it holds the seed AND the "
                              "signing index; reusing a leaf breaks security"}, indent=2))


def cmd_sign(a):
    key = _load(a.key)
    sig = sign(key, a.msg.encode())
    _save(a.key, key)                     # persist advanced index
    out = a.out or (a.key + f".sig{sig['index']}.json")
    _save(out, sig)
    print(json.dumps({"signed_index": sig["index"], "sig_file": out,
                      "root": sig["root"]}, indent=2))


def cmd_verify(a):
    sig = _load(a.sig)
    good = verify(a.root, a.msg.encode(), sig)
    print(json.dumps({"valid": good}, indent=2))
    sys.exit(0 if good else 1)


def cmd_selftest(a):
    checks = []

    def ok(name, cond):
        checks.append((name, bool(cond)))
        print(("  ok  " if cond else "FAIL  ") + name)

    key = keygen(3)                       # 8 one-time leaves
    root = key["root"]
    s0 = sign(key, b"I attest: ring 42 is mine")
    ok("valid signature verifies against the root",
       verify(root, b"I attest: ring 42 is mine", s0))
    ok("a tampered message fails verification",
       not verify(root, b"I attest: ring 43 is mine", s0))
    forged = dict(s0); forged["ots"] = list(s0["ots"]); forged["ots"][0] = os.urandom(N).hex()
    ok("a forged OTS reveal fails verification",
       not verify(root, b"I attest: ring 42 is mine", forged))
    s1 = sign(key, b"second attestation")
    ok("the tree signs multiple messages (distinct leaves)",
       s1["index"] == 1 and verify(root, b"second attestation", s1))
    ok("signing advances the index (no silent leaf reuse)", key["next_index"] == 2)
    # exhaust
    for _ in range(6):
        sign(key, os.urandom(8))
    try:
        sign(key, b"one too many")
        ok("exhausted key refuses to sign (Lamport reuse is fatal)", False)
    except RuntimeError:
        ok("exhausted key refuses to sign (Lamport reuse is fatal)", True)
    ok("scheme is pure-hash (no elliptic curve; Grover-only -> 128-bit PQ)",
       key["scheme"] == "lamport-merkle(sha256)")

    failed = [n for n, c in checks if not c]
    print(f"SELFTEST {'PASS' if not failed else 'FAIL'} {len(checks)} checks"
          + (f" — failed: {failed}" if failed else ""))
    sys.exit(1 if failed else 0)


def main():
    p = argparse.ArgumentParser(description="pqsign — hash-based post-quantum signatures.")
    sub = p.add_subparsers(dest="cmd", required=True)
    pk = sub.add_parser("keygen"); pk.add_argument("--height", type=int, default=6)
    pk.add_argument("--out", required=True); pk.set_defaults(func=cmd_keygen)
    ps = sub.add_parser("sign"); ps.add_argument("--key", required=True)
    ps.add_argument("--msg", required=True); ps.add_argument("--out", default=None)
    ps.set_defaults(func=cmd_sign)
    pv = sub.add_parser("verify"); pv.add_argument("--root", required=True)
    pv.add_argument("--sig", required=True); pv.add_argument("--msg", required=True)
    pv.set_defaults(func=cmd_verify)
    sub.add_parser("selftest").set_defaults(func=cmd_selftest)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
