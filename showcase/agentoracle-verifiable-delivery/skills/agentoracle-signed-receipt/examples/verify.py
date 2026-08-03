#!/usr/bin/env python3
"""
Offline verifier for the AgentOracle demo receipt.

Uses the AgentOracle PyPI verifier library `agentoracle-receipt-verify`
against the receipt file committed here (`receipt.json`) and the live
JWKS published at https://agentoracle.co/.well-known/jwks.json.

Runs three checks per the receipt-spec conformance suite:

  1. Canonical bytes recompute — verify the payload bytes canonicalize
     back to the same JCS form.
  2. Canonical hash matches the claimed canonical_sha256.
  3. Ed25519 signature over the JWS signing input verifies against the
     JWK identified by the protected header's `kid`.

Exit code 0 if all three pass, non-zero otherwise.

Usage:
    python3 verify.py [receipt.json]

    receipt.json defaults to the sibling file in this directory.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path


JWKS_URL = "https://agentoracle.co/.well-known/jwks.json"


def load_receipt(path: str | os.PathLike) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def fetch_live_jwks() -> dict:
    with urllib.request.urlopen(JWKS_URL, timeout=15) as r:
        return json.load(r)


def main() -> int:
    here = Path(__file__).resolve().parent
    receipt_path = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "receipt.json"

    print(f"receipt:  {receipt_path}")
    print(f"jwks_url: {JWKS_URL}")
    print()

    try:
        from agentoracle_receipt_verify import verify
    except ImportError:
        print("MISSING DEPENDENCY: install with:")
        print("    pip install agentoracle-receipt-verify")
        return 2

    receipt = load_receipt(receipt_path)
    jwks = fetch_live_jwks()

    result = verify(receipt, {JWKS_URL: jwks})

    print("=== VerifyResult ===")
    print(f"  canonical_sha256:  {result.canonical_sha256}")
    print(f"  valid:             {result.valid}")
    print(f"  checks:            {result.checks}")
    print(f"  signers:           {result.signers}")
    if result.errors:
        print(f"  errors:            {result.errors}")
        return 1
    return 0 if result.valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
