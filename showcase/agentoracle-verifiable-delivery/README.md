# AgentOracle Verifiable Delivery — Showcase Package

## What this is

An ACP transaction outcome, recorded as a signed evidence artifact
that any third party can verify **offline** against the issuer's
published JWKS. No network access to AgentOracle infrastructure is
required to verify — just the receipt file, the published public key,
and a small reference verifier.

## What a reviewer is looking at

Three artifacts, produced against the live production
AgentOracle rail:

1. **`skills/agentoracle-signed-receipt/examples/compose_request.json`**
   — the exact request body sent to `POST /v1/compose` on the live
   Zuplo gateway. Content-addressed via `subject.claim_hash` and
   `subject.skill_hash`.
2. **`skills/agentoracle-signed-receipt/examples/receipt.json`** —
   the JWS General Serialization envelope returned by the gateway.
   Signed with `kid: ao-composed-2026-07-ed25519-3d44ba27`, published
   in the live JWKS.
3. **`skills/agentoracle-signed-receipt/examples/verify-output.txt`**
   — the actual output of running the reference verifier
   (`agentoracle-receipt-verify`) against the committed receipt +
   the live JWKS. `valid: True`, exit code 0.

Plus:

- **`skills/agentoracle-signed-receipt/SKILL.md`** — the reusable
  skill contract (when to use, inputs, tools, credentials, approval
  gates, stop conditions, validation, output contract).
- **`skills/agentoracle-signed-receipt/examples/prompt.md`** — the
  scenario, request shape, and reproduction steps.
- **`skills/agentoracle-signed-receipt/examples/result-redacted.md`**
  — the redacted run report showing HTTP request, response,
  decoded receipt payload, verification output, and public/private
  boundaries.

## Three verify commands

Any reviewer with Python 3.10+ can independently verify the committed
receipt in under a minute:

```bash
# 1. Install the reference verifier from PyPI (Apache-2.0, ~600 lines).
pip install agentoracle-receipt-verify

# 2. Change into the examples folder where the receipt lives.
cd showcase/agentoracle-verifiable-delivery/skills/agentoracle-signed-receipt/examples

# 3. Run the verifier against the committed receipt + live JWKS.
python3 verify.py
```

Expected output (exit code 0):

```
receipt:  .../skills/agentoracle-signed-receipt/examples/receipt.json
jwks_url: https://agentoracle.co/.well-known/jwks.json

=== VerifyResult ===
  canonical_sha256:  sha256-b9cf4e4afbee83cfd110c7923c6adff68a70487fb2cc7053fcb203e898afd695
  valid:             True
  checks:            {'canonical_recomputes': True, 'all_signatures_verified': True}
  signers:           [{'kid': 'ao-composed-2026-07-ed25519-3d44ba27',
                       'issuer': 'https://agentoracle.co/.well-known/jwks.json',
                       'verified': True}]
```

If any check returns False, or the exit code is non-zero, the
receipt is not authentic — do not treat it as evidence.

## Why this matters for ACP

When two ACP agents settle a transaction and later disagree about
what actually happened — did the deliverable arrive? did the
recommended action satisfy the caller's rules? was the adversarial
check performed? — the retained receipt is the tiebreaker. Either
party, or a neutral auditor with no AgentOracle account, can run the
three verify commands above and get a byte-level yes/no.

The receipt is content-addressed (RFC 8785 JCS + Ed25519 per RFC 8032)
so the same inputs produce byte-identical canonical bytes. Post-hoc
edits invalidate the signature. Retention is durable — the JWKS is
publicly cacheable, and retired keys stay in the JWKS for at least
12 months after rotation.

## Live production, not fixtures

The receipt committed here was produced against the live production
AgentOracle rail on 2026-08-03 — the same rail that serves every paid
customer, the same signing key (`ao-composed-2026-07-ed25519-3d44ba27`)
that verifies against the live JWKS at
https://agentoracle.co/.well-known/jwks.json.

No fixtures, no mocks, no test-mode keys. If the receipt verifies,
that is because the AgentOracle production key signed it in that
exact byte order at that exact decision point.

## References

- Receipt format specification (IETF Internet-Draft):
  https://datatracker.ietf.org/doc/draft-krausz-verification-state
- Open draft under review — v0.4 (sealed evidence + multi-clock anchors),
  not part of this demo's shipped envelope. Pointer only:
  https://github.com/TKCollective/agentoracle-receipt-spec/pull/5
- PyPI reference verifier:
  https://pypi.org/project/agentoracle-receipt-verify/
- Whitepaper: https://agentoracle.co/whitepaper

## Learn more

https://agentoracle.co
