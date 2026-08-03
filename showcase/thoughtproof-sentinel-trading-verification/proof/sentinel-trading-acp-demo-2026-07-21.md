# Sentinel ACP trading demo — proof artifact

- Generated: 2026-07-21T12:20:17.988Z
- Offering: `agent_output_verification` on Base (8453)
- Seller: `0x05ad872fe61d33674e29defae0a42a521460d85f`
- Buyer: `0x73c0b32ae9f5a04e1345f7a4808ca5c55635bf0b`
- Completed: 3/3; matched expectation: 3/3

| Case | Job | Expected | Actual | Confidence | Outcome |
|---|---:|---|---:|---:|---|
| ALLOW — clean BTC setup | 70169 | ALLOW | ALLOW | 1 | completed |
| BLOCK — threshold + direction violation | 70170 | BLOCK | BLOCK | 0 | completed |
| UNCERTAIN — mixed volatile signals | 70171 | UNCERTAIN | UNCERTAIN | 0.417 | completed |

Raw JSON: same basename `.json`. No secrets; public wallet addresses only.
