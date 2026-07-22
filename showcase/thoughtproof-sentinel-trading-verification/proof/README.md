# Redacted proof — Sentinel trading verification ACP run

Run date: 2026-07-21  
Network: Base (`8453`)  
Offering: `agent_output_verification` (0.01 USDC fixed, 60-minute SLA, `requiredFunds: false`)

| Case | ACP job | Mode / tier | Expected | Actual | Confidence | Models | Verification id |
|---|---:|---|---|---:|---:|---|---|
| Clean BTC setup | 70169 | `trade_execution` / `checkpoint` | ALLOW | ALLOW | 1.000 | `serv-nano` | `sent_b028c74fe8ff43f5` |
| Threshold + direction violation | 70170 | `trade_execution` / `checkpoint` | BLOCK | BLOCK | 0.000 | `serv-nano` | `sent_c84b4c2105bc4619` |
| Mixed volatile signals | 70171 | `trade_execution` / `standard` | UNCERTAIN | UNCERTAIN | 0.417 | `serv-nano`, `serv-swift` | `sent_66e5da742e3a455b` |

Result: **3/3 completed, 3/3 matched expectation.**

Scope note: these are the three packaged demo jobs from 2026-07-21. The live agent has other lifetime jobs from graduation and testing; this artifact is a selected proof run, not a complete job history. The trading signals are demonstration patterns, not endorsed trading strategies.

## What the deliverable contains

Each completed job delivered a JSON payload with:

- `verdict` and `confidence`
- `reasoning`
- structured `objections[]` (`step_id`, `criterion`, `score`, `predicate`, `quote`, `reasoning`)
- `mode`, `tier`, `models_used`
- `verificationId`
- `attestation` (`prepared`, `issued`, `schema_uid`, `claim_hash`, `evidence_hash`)

In this run the attestation block was `prepared: true, issued: false`: hashes and schema UID are present, but no EAS attestation was issued in this environment.

## On-chain settlement check

Around the clean three-job run:

- Buyer: `0.253 → 0.2245` USDC (`-0.0285`)
- Seller: `0.135 → 0.162` USDC (`+0.027`)

That matches 3 × 0.01 USDC jobs with the typical ≈5.5% Virtuals platform fee.

## Redaction

No private keys, no `.env` values, no private agent instructions. Public wallet addresses only:

- Seller: `0x05ad872fe61d33674e29defae0a42a521460d85f`
- Buyer: `0x73c0b32ae9f5a04e1345f7a4808ca5c55635bf0b`

Files:

- `sentinel-trading-acp-demo-2026-07-21.md` — human-readable summary
- `sentinel-trading-acp-demo-2026-07-21.json` — full redacted artifact with requests, timings, parsed deliverables, objections, verification ids, and attestation hashes
