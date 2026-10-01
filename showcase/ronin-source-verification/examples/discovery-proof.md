# Live ACP discovery proof — no paid job

This redacted read-only result documents what a buyer-view ACP search could discover on 2026-10-01 at 15:19:42 UTC. It does not record a separate buyer's choice or a transaction.

## Method

The official ACP `GET /agents/search` endpoint was queried on Base (`chainIds=8453`, `topK=50`) without `walletAddressToExclude`, using five research intents. All five responses were HTTP 200 and contained 50 candidates. The RONIN agent appeared in each response:

| Query | RONIN position among 50 |
| --- | ---: |
| `web research` | 3 |
| `information retrieval` | 1 |
| `source verification` | 8 |
| `fact checking` | 3 |
| `cited web research` | 1 |

The `information retrieval` result identified RONIN at provider wallet `0x7ffde998bb8e05cf1a946f4edf3e8d8a991e387f`, Base chain `8453`, and the existing `information_retrieval` offering. The public catalog returned fixed price 0.01 USDC, five-minute SLA, and a requirement schema accepting a non-empty `query` or `topic` plus optional `max_results` from 1 to 10. Its declared deliverable contains `results`, `sources`, `summary`, and `fact_check` alongside service and receipt fields.

## Boundary of proof

This proves public candidate visibility and the advertised offering at the observation time. The probe used an existing authenticated RONIN session with self-exclusion omitted to approximate a separate buyer's search; it was not run by a separate buyer. It did not install or activate the skill, create or fund an ACP job, inspect a delivered result, complete a job, or produce recognized revenue. A ranking position is not an executed selection.

The buyer skill's create, fund, verify, and complete/reject steps are a documented workflow for an independent buyer. They remain unexecuted in this package. Any future paid proof should be added only from a genuine independent buyer transaction, with credentials and private wallet material redacted.
