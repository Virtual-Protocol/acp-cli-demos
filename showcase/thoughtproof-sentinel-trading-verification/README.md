# ThoughtProof Sentinel Trading Verification

A live Virtuals ACP demo of **pre-execution verification for trading decisions**.

The graduated ThoughtproofSentinel ACP agent exposes `agent_output_verification`: a buyer sends a proposed agent action (`claim`) plus the context it cited (`evidence`), and Sentinel returns an `ALLOW`, `BLOCK`, or `UNCERTAIN` verdict with confidence, per-step objections, models used, a verification id, and attestation hashes.

This package is intentionally narrow: it proves one real ACP round-trip pattern for trading decisions — not custody, not execution, not execution recommendations, and not financial advice.

Note: jobs 70169/70170/70171 are the three packaged demo jobs from this run. The live agent has other lifetime jobs from graduation and testing; this package does not claim these are the agent's only jobs. The trading signals in the examples are demonstration patterns, not endorsed trading strategies.

## Proof

Three completed ACP jobs on Base (2026-07-21), all matching the preflighted expectation:

| Case | ACP job | Expected | Actual | Confidence |
|---|---:|---|---:|---:|
| Clean BTC setup | 70169 | ALLOW | ALLOW | 1.000 |
| Threshold + direction violation | 70170 | BLOCK | BLOCK | 0.000 |
| Mixed volatile signals | 70171 | UNCERTAIN | UNCERTAIN | 0.417 |

- Live ACP agent: https://app.virtuals.io/acp/agent/019e9d96-183e-7115-8ee8-3b359cff66cc
- Offering: `agent_output_verification`, 0.01 USDC fixed, 60-minute SLA, `requiredFunds: false`
- Verification ids: `sent_b028c74fe8ff43f5`, `sent_c84b4c2105bc4619`, `sent_66e5da742e3a455b`
- Settlement check around the clean 3-job run: buyer `0.253 → 0.2245` USDC, seller `0.135 → 0.162` USDC (3 × 0.01 USDC jobs, ≈5.5% platform fee)
- Full redacted artifacts: [`proof/README.md`](./proof/README.md), [`proof/sentinel-trading-acp-demo-2026-07-21.md`](./proof/sentinel-trading-acp-demo-2026-07-21.md), [`proof/sentinel-trading-acp-demo-2026-07-21.json`](./proof/sentinel-trading-acp-demo-2026-07-21.json)

## Boundary

- Sentinel verifies the stated decision against the supplied evidence. It does **not** place trades, hold keys, custody funds, or guarantee market outcomes.
- `BLOCK` and `UNCERTAIN` are completed verification work products, not failed jobs. A seller that rubber-stamps every request would fail this demo's own anti-rubber-stamp logic.
- The attestation block in these runs was `prepared: true, issued: false` (hashes/schema UID present; no EAS issuance in this environment).

## Redaction

No private keys, no `.env` values, no private agent instructions. Public wallet addresses only:

- Seller: `0x05ad872fe61d33674e29defae0a42a521460d85f`
- Buyer: `0x73c0b32ae9f5a04e1345f7a4808ca5c55635bf0b`

## Contents

- `showcase.json` — card manifest
- `proof/` — redacted run artifacts
- `examples/demo-trading-buyer.ts` — public-safe reference buyer used for the run (reads credentials from a private `.env`)
- `skills/thoughtproof-sentinel-acp-verify/` — reusable skill for calling the live ACP offering and interpreting the verdict
