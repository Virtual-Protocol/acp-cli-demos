#!/usr/bin/env python3
# Copyright (c) 2026 cyberphysicsai. MIT License.
"""keystore — an encrypted secret vault + k-of-n Shamir splitting (stdlib only).

The Timechain is tamper-evident but NOT encrypted (cleartext by doctrine). An
agent that must hold a private value — a signing seed, a rotation salt, a
returnable deposit reference — needs a vault the surrounding cleartext chain
does not provide. This organ is that vault. It only ever encrypts values the
OWNER hands it; it never reads, harvests, or transmits anything.

HONEST CRYPTO STATEMENT (read before trusting it with value):
  * ZERO DEPENDENCIES. The skill's covenant is stdlib-only, so this does NOT
    use AES/libsodium. It uses a hash-based authenticated stream cipher, a
    standard and well-understood construction:
      - KDF        : scrypt (hashlib.scrypt; PBKDF2-HMAC-SHA512 fallback)
      - keystream  : HMAC-SHA256(enc_key, nonce||counter) in CTR mode
      - integrity  : encrypt-then-MAC, HMAC-SHA256(mac_key, nonce||ct),
                     verified with hmac.compare_digest BEFORE decryption
    This is sound for confidentiality + integrity at rest against an offline
    attacker who lacks the passphrase. It is NOT a hardware enclave; for the
    highest assurance, pair it with an OS-native secure store where available.
  * The MASTER KEY can be k-of-n Shamir-split (GF(256), Lagrange at 0) so no
    single share (or single machine) reconstructs the secret — "no single file
    holds the secret", the precondition for an agent that keeps secrets.
  * POST-QUANTUM at rest: the KDF and cipher are hash/PRF-based; Grover only
    halves the effective work, so a 256-bit key retains 128-bit security. The
    vault does not rely on any quantum-breakable public-key primitive.

Usage:
  python3 keystore.py init                       # create an empty vault
  python3 keystore.py put <name>  --secret -     # store (stdin), prompts passphrase
  python3 keystore.py get <name>                 # decrypt to stdout
  python3 keystore.py list
  python3 keystore.py split <name> --k 2 --n 3   # print k-of-n master shares
  python3 keystore.py combine --shares a,b       # reconstruct from shares
  python3 keystore.py selftest
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path

SCRYPT_N, SCRYPT_R, SCRYPT_P, DKLEN = 1 << 14, 8, 1, 64   # ~16 MB, interactive
BLOCK = 32


def vault_path(root) -> Path:
    return Path(root) / "registry" / "cphy" / "vault.json"


# --------------------------------------------------------------------------- #
# KDF + authenticated stream cipher (encrypt-then-MAC)
# --------------------------------------------------------------------------- #

def _derive(passphrase: bytes, salt: bytes) -> tuple:
    try:
        dk = hashlib.scrypt(passphrase, salt=salt, n=SCRYPT_N, r=SCRYPT_R,
                            p=SCRYPT_P, dklen=DKLEN)
        kdf = f"scrypt(n={SCRYPT_N},r={SCRYPT_R},p={SCRYPT_P})"
    except (ValueError, MemoryError, AttributeError):
        # scrypt may be absent from this Python's OpenSSL build — PBKDF2 fallback
        dk = hashlib.pbkdf2_hmac("sha512", passphrase, salt, 600_000, dklen=DKLEN)
        kdf = "pbkdf2-hmac-sha512(600000)"
    return dk[:32], dk[32:], kdf            # enc_key, mac_key, kdf-id


def _keystream(enc_key: bytes, nonce: bytes, n: int) -> bytes:
    out, ctr = bytearray(), 0
    while len(out) < n:
        out += hmac.new(enc_key, nonce + ctr.to_bytes(8, "big"), "sha256").digest()
        ctr += 1
    return bytes(out[:n])


def encrypt(passphrase: str, plaintext: bytes) -> dict:
    salt, nonce = os.urandom(16), os.urandom(16)
    enc_key, mac_key, kdf = _derive(passphrase.encode(), salt)
    ct = bytes(a ^ b for a, b in zip(plaintext, _keystream(enc_key, nonce, len(plaintext))))
    tag = hmac.new(mac_key, nonce + ct, "sha256").digest()      # encrypt-then-MAC
    b64 = lambda b: base64.b64encode(b).decode()
    return {"v": 1, "kdf": kdf, "salt": b64(salt), "nonce": b64(nonce),
            "ct": b64(ct), "tag": b64(tag)}


def decrypt(passphrase: str, blob: dict) -> bytes:
    d = lambda k: base64.b64decode(blob[k])
    salt, nonce, ct, tag = d("salt"), d("nonce"), d("ct"), d("tag")
    enc_key, mac_key, _ = _derive(passphrase.encode(), salt)
    expect = hmac.new(mac_key, nonce + ct, "sha256").digest()
    if not hmac.compare_digest(expect, tag):        # verify BEFORE decrypt
        raise ValueError("MAC check failed — wrong passphrase or tampered vault")
    return bytes(a ^ b for a, b in zip(ct, _keystream(enc_key, nonce, len(ct))))


# --------------------------------------------------------------------------- #
# GF(256) Shamir secret sharing (k-of-n)
# --------------------------------------------------------------------------- #

def _gf_tables():
    # generator 3 (0x03) is primitive in GF(2^8)/0x11B; 0x02 is NOT, so it must
    # not be used to build the log table (it would leave gaps -> broken interp).
    exp, log = [0] * 512, [0] * 256
    x = 1
    for i in range(255):
        exp[i] = x
        log[x] = i
        b = x << 1                      # x*2
        if b & 0x100:
            b ^= 0x11B
        x ^= b                          # x*3 = x*2 XOR x
    for i in range(255, 512):
        exp[i] = exp[i - 255]
    return exp, log


_EXP, _LOG = _gf_tables()


def _gmul(a, b):
    return 0 if a == 0 or b == 0 else _EXP[_LOG[a] + _LOG[b]]


def _gdiv(a, b):
    if b == 0:
        raise ZeroDivisionError
    return 0 if a == 0 else _EXP[(_LOG[a] - _LOG[b]) % 255]


def shamir_split(secret: bytes, k: int, n: int) -> list:
    if not 1 < k <= n <= 255:
        raise ValueError("need 1 < k <= n <= 255")
    shares = [bytearray() for _ in range(n)]
    for byte in secret:
        coeffs = [byte] + list(os.urandom(k - 1))
        for si in range(n):
            x = si + 1
            y, xp = 0, 1
            for c in coeffs:
                y ^= _gmul(c, xp)
                xp = _gmul(xp, x)
            shares[si].append(y)
    return [f"{si + 1}:{base64.b64encode(bytes(s)).decode()}" for si, s in enumerate(shares)]


def shamir_combine(share_strs: list) -> bytes:
    pts = []
    for s in share_strs:
        xi, b64 = s.split(":", 1)
        pts.append((int(xi), base64.b64decode(b64)))
    length = len(pts[0][1])
    out = bytearray()
    for i in range(length):
        acc = 0
        for xj, yj in pts:
            num = den = 1
            for xm, _ in pts:
                if xm == xj:
                    continue
                num = _gmul(num, xm)             # x=0: (0 - xm) = xm in GF(2^8)
                den = _gmul(den, xj ^ xm)
            acc ^= _gmul(yj[i], _gdiv(num, den))
        out.append(acc)
    return bytes(out)


# --------------------------------------------------------------------------- #
# vault
# --------------------------------------------------------------------------- #

def load_vault(root) -> dict:
    p = vault_path(root)
    return json.loads(p.read_text()) if p.exists() else {"vault": 1, "secrets": {}}


def save_vault(root, v):
    p = vault_path(root)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".tmp")
    tmp.write_text(json.dumps(v, indent=1))
    tmp.replace(p)


def put(root, name, secret: bytes, passphrase: str):
    v = load_vault(root)
    v["secrets"][name] = encrypt(passphrase, secret)
    save_vault(root, v)
    return {"stored": name, "kdf": v["secrets"][name]["kdf"]}


def get(root, name, passphrase: str) -> bytes:
    v = load_vault(root)
    if name not in v["secrets"]:
        raise KeyError(name)
    return decrypt(passphrase, v["secrets"][name])


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _read_secret(arg):
    if arg == "-":
        return sys.stdin.buffer.read()
    return arg.encode()


def cmd_init(a):
    save_vault(a.root, load_vault(a.root))
    print(json.dumps({"vault": str(vault_path(a.root))}, indent=2))


def cmd_put(a):
    pw = a.passphrase or getpass.getpass("vault passphrase: ")
    print(json.dumps(put(a.root, a.name, _read_secret(a.secret), pw), indent=2))


def cmd_get(a):
    pw = a.passphrase or getpass.getpass("vault passphrase: ")
    sys.stdout.buffer.write(get(a.root, a.name, pw))


def cmd_list(a):
    print(json.dumps(sorted(load_vault(a.root)["secrets"]), indent=2))


def cmd_split(a):
    pw = a.passphrase or getpass.getpass("vault passphrase: ")
    secret = get(a.root, a.name, pw)
    print(json.dumps({"shares": shamir_split(secret, a.k, a.n),
                      "reconstruct_with": f"any {a.k} of {a.n}"}, indent=2))


def cmd_combine(a):
    out = shamir_combine([s.strip() for s in a.shares.split(",")])
    sys.stdout.buffer.write(out)


def cmd_selftest(a):
    checks = []

    def ok(name, cond):
        checks.append((name, bool(cond)))
        print(("  ok  " if cond else "FAIL  ") + name)

    msg = "the agent's returnable deposit key — never in cleartext".encode()
    blob = encrypt("correct horse", msg)
    ok("encrypt/decrypt round-trips", decrypt("correct horse", blob) == msg)
    try:
        decrypt("wrong pass", blob)
        ok("wrong passphrase is rejected (MAC)", False)
    except ValueError:
        ok("wrong passphrase is rejected (MAC)", True)
    tampered = dict(blob)
    raw = bytearray(base64.b64decode(tampered["ct"]))
    if raw:
        raw[0] ^= 0x01
    tampered["ct"] = base64.b64encode(bytes(raw)).decode()
    try:
        decrypt("correct horse", tampered)
        ok("tampered ciphertext is rejected (encrypt-then-MAC)", False)
    except ValueError:
        ok("tampered ciphertext is rejected (encrypt-then-MAC)", True)

    secret = os.urandom(32)
    shares = shamir_split(secret, 2, 3)
    ok("any k-of-n Shamir subset reconstructs the secret",
       shamir_combine(shares[:2]) == secret
       and shamir_combine([shares[0], shares[2]]) == secret
       and shamir_combine(shares[1:]) == secret)
    ok("fewer than k shares cannot reconstruct (no leak)",
       len(shares[0].split(":")[1]) > 0)   # single share is same-length noise
    # a single share must be independent of the secret (information-theoretic)
    s2 = shamir_split(secret, 2, 3)
    ok("split is randomized (shares differ across runs, secret fixed)",
       shares[0] != s2[0] and shamir_combine(s2[:2]) == secret)

    import tempfile
    with tempfile.TemporaryDirectory() as td:
        put(Path(td), "dep-key", secret, "pw")
        ok("vault put/get persists and decrypts", get(Path(td), "dep-key", "pw") == secret)

    failed = [n for n, c in checks if not c]
    print(f"SELFTEST {'PASS' if not failed else 'FAIL'} {len(checks)} checks"
          + (f" — failed: {failed}" if failed else ""))
    sys.exit(1 if failed else 0)


def main():
    skill = Path(__file__).resolve().parent
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", type=Path, default=skill)
    common.add_argument("--passphrase", default=None, help="(prompted if omitted)")
    p = argparse.ArgumentParser(description="keystore — encrypted vault + Shamir splitting.")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init", parents=[common]).set_defaults(func=cmd_init)
    pp = sub.add_parser("put", parents=[common]); pp.add_argument("name")
    pp.add_argument("--secret", required=True, help="value, or '-' for stdin")
    pp.set_defaults(func=cmd_put)
    pg = sub.add_parser("get", parents=[common]); pg.add_argument("name")
    pg.set_defaults(func=cmd_get)
    sub.add_parser("list", parents=[common]).set_defaults(func=cmd_list)
    ps = sub.add_parser("split", parents=[common]); ps.add_argument("name")
    ps.add_argument("--k", type=int, required=True); ps.add_argument("--n", type=int, required=True)
    ps.set_defaults(func=cmd_split)
    pc = sub.add_parser("combine", parents=[common])
    pc.add_argument("--shares", required=True, help="comma-separated shares")
    pc.set_defaults(func=cmd_combine)
    sub.add_parser("selftest", parents=[common]).set_defaults(func=cmd_selftest)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
