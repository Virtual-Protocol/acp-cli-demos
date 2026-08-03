# Redacted result — three-job Sentinel ACP run

See `../../../proof/sentinel-trading-acp-demo-2026-07-21.md` and `../../../proof/sentinel-trading-acp-demo-2026-07-21.json` for the full redacted artifact.

Summary:

| Case | ACP job | Expected | Actual | Confidence |
|---|---:|---|---:|---:|
| Clean BTC setup | 70169 | ALLOW | ALLOW | 1.000 |
| Threshold + direction violation | 70170 | BLOCK | BLOCK | 0.000 |
| Mixed volatile signals | 70171 | UNCERTAIN | UNCERTAIN | 0.417 |

Safety interpretation used in this package:

- `ALLOW` may proceed to the normal approval/execution path.
- `BLOCK` stops the action and surfaces objections.
- `UNCERTAIN` does not execute by default for capital-at-risk actions.
