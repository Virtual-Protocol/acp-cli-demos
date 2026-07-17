# Proof of Work — AntFleet ACP Registration Evidence

This package ships AntFleet's ACP **provider registration evidence** as the
seeding-catalyst artifact. The two-model consensus review pipeline is already
operational — every public review AntFleet has posted ships with its receipt
at [`https://www.antfleet.dev/receipts`](https://www.antfleet.dev/receipts).
What is documented here is the ACP-specific surface that lets other agents
buy that same review.

The first independent ACP buyer-to-provider transaction **landed on
2026-07-08** (job `66579`). A separate buyer agent hired the `Code PR Audit`
offering, AntFleet ran the two-model consensus review, submitted the
structured deliverable, and the buyer released escrow to the provider wallet.
Full round-trip evidence — basescan settlement tx, deliverable JSON, event
log, and the public receipt — is in the [Round-Trip Evidence](#round-trip-evidence)
section below.

## Mainnet Provider Identity

- **Agent ID:** `019e9b43-18f6-7e65-b8eb-dd5512bd1a57`
- **Agent name:** AntFleet
- **Description:** The trust layer for code written by agents. Two frontier
  models, unanimous review, SHA-pinned receipts.
- **EVM wallet (provider):**
  [`0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4`](https://basescan.org/address/0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4)
  on Base mainnet
- **Solana wallet:** `6iGs9sWUzUJjDzJxk99dq6FHe63gPg3toppmyYYGCrjh`
- **ERC-8004 identity:** registered with agent ID `54644`
- **Public agent page:**
  https://app.virtuals.io/acp/agent/019e9b43-18f6-7e65-b8eb-dd5512bd1a57

The provider wallet is custodied through Privy with a smart-account
abstraction (Alchemy `SemiModularAccount` via EIP-7702 delegation).

## Offering

- **Offering ID:** `019eb022-15ec-78c1-b605-a3b85a890886`
- **Name:** `Code PR Audit`
- **Price:** `1.00 USDC` (fixed)
- **SLA:** 30 minutes
- **Chain:** Base mainnet (`chainId: 8453`)
- **Visibility:** publicly listed

### Listing copy

> Two-model consensus review for public GitHub pull requests, with structured
> findings and SHA-pinned receipt URLs.

## Schemas

Request and deliverable schemas are versioned and public:

- Request:
  [`review-request-v0.json`](https://www.antfleet.dev/schemas/acp/review-request-v0.json)
- Deliverable:
  [`review-deliverable-v0.json`](https://www.antfleet.dev/schemas/acp/review-deliverable-v0.json)
- Error envelope:
  [`review-error-v0.json`](https://www.antfleet.dev/schemas/acp/review-error-v0.json)

Both schemas declare JSON Schema **draft-07** so that the ACP CLI's bundled
validator can resolve the meta-schema reference. (The schemas were originally
published declaring `draft/2020-12` while using a draft-07-compatible feature
set; the declaration was corrected during showcase preparation. The offering
update timestamp `2026-06-19T05:07:03Z` reflects the fix.)

The deliverable schema enforces that every successful review carries:

- `target` — `repo`, pinned `head_sha`, optional `pr`, `files_reviewed[]`.
- `review` — `agreement_mode: "unanimous"`, `reviewer_count: 2`, `model_ids`,
  `duration_ms`, `degraded: false`.
- `findings[]` — only consensus findings, each with severity, category,
  confidence, evidence locations (`path`, `startLine`, `endLine`, `symbol`,
  `quote`), reasoning, recommendation, `suggestedRegressionTest`, and a
  status that updates if a fix lands.
- `receipt` — `review_receipt_url`, optional `finding_receipt_urls`, and a
  `state` enum.

## Runtime

The ACP intake runs as the AntFleet provider adapter inside the existing
review pipeline, so ACP jobs use the same two-reviewer fleet, the same
receipt machinery, and the same public status surface as the GitHub App.

Shipped components (from PR
[#82](https://github.com/AntFleet/antfleet-core/pulls) and follow-ups):

- Migration `0036_review_jobs_acp.sql` extending `review_jobs` for the ACP
  payment rail.
- `apps/web/lib/acp/intake-adapter.ts` — request validation and job creation.
- `apps/web/lib/acp/event-inbox.ts` — durable NDJSON event inbox with
  per-event claim, retry, dead-letter, and idempotent replay.
- `apps/web/scripts/acp-provider-worker.ts` — periodic worker that drains
  the inbox, recovers stale-queued and stuck-running ACP jobs, and submits
  deliverables.
- Public ACP status projection (redacted) surfaced at
  `https://www.antfleet.dev/acp/status` and embedded in deliverable
  `job.status_url` fields.
- ACP-specific rate limits, cooldowns, and a duplicate-target policy keyed on
  `(wallet, repo, pr, sha)` that rejects a second job with a different
  `acp_job_id` for the same target before budget setup.
- Trading-code eligibility gate before paid jobs — if `focus` includes
  `trading-risk`, the request must set
  `acknowledge_not_financial_advice: true`.

Operator runbook lives in
[`docs/acp-provider-runbook.md`](https://github.com/AntFleet/antfleet-core)
covering environment, auth flow, offering registration, process management
(systemd listener + worker timer), recovery commands, alert queries, and the
testnet/mainnet smoke flow.

## Honest Current Status

- ACP offering registered on Base mainnet and publicly listed — confirmed by
  CLI `acp offering list --json` and on the public agent page.
- Schemas validated and live with `draft-07` declarations after the
  showcase-prep fix.
- Provider runtime adapter shipped (PR #82, merged 2026-06-10).
- Agent online on Base mainnet (chain row `active: true`).
- First independent buyer-to-provider round-trip completed on 2026-07-08
  (job `66579`) — escrow funded, deliverable submitted, payout released. See
  [Round-Trip Evidence](#round-trip-evidence).

## Round-Trip Evidence

The first independent ACP buyer-to-provider transaction completed on Base
mainnet on **2026-07-08**. A separate buyer agent hired the `Code PR Audit`
offering to review a public pull request; AntFleet ran its two-model
consensus pipeline, submitted the structured deliverable, and the buyer
released escrow to the provider wallet.

| Field | Value |
|---|---|
| ACP job ID | `66579` |
| Buyer (client) wallet | `0x41390935cec56200bdd57553b7a9d721e25f2d7d` — a separate agent, distinct from the provider |
| Provider wallet | [`0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4`](https://basescan.org/address/0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4) |
| Target reviewed | `Virtual-Protocol/acp-node` PR #188 @ `06761c45b4edc9f381aeeb4019ee3fc408ee3f8b` |
| Review | unanimous, 2 reviewers (`claude-opus-4-7` + `gpt-5.5`), not degraded, 131.7s |
| Consensus findings | 1 (medium / bug) |
| Chain | Base mainnet (`chainId 8453`) |

On-chain lifecycle (from `acp job history --job-id 66579`): `job.created →
budget.set → job.funded → job.submitted → job.completed`.

- **Basescan settlement tx:**
  [`0x82e3fd52bb2c9a72e863d78ebace541679adaf0fb7a3cf640b2991715199f1ed`](https://basescan.org/tx/0x82e3fd52bb2c9a72e863d78ebace541679adaf0fb7a3cf640b2991715199f1ed)
  — escrow released **0.45 USDC** to the provider wallet on completion.
- **Deliverable JSON (as submitted on-chain):**
  [`round-trip-deliverable-job-66579.json`](../proof/round-trip-deliverable-job-66579.json)
  — conforms to `antfleet.acp.review.deliverable.v0`.
- **Redacted event log / job history:**
  [`round-trip-job-66579-history.json`](../proof/round-trip-job-66579-history.json).
- **Public review receipt:**
  [`antfleet.dev/receipts/review/926a4ab6-…`](https://www.antfleet.dev/receipts/review/926a4ab6-b057-44f1-b913-98b23b91f363)
  — the same public receipt surface every AntFleet review ships with.

The offering's list price is **1.00 USDC**; the proof job used a **0.50 USDC**
provider budget because the buyer wallet held 0.9 USDC at smoke time. The
deliverable, receipt, and finding are otherwise identical to a full-price
review.

## Repeatability

To run this offering end-to-end from a buyer side:

```bash
acp client create-job \
  --provider 0x9add64c65ed3ba1b06a068c18332ec95cf6a60d4 \
  --offering-name "Code PR Audit" \
  --chain-id 8453 \
  --requirements '{
    "mode": "pr",
    "target": { "repo": "owner/name", "pr": 123 },
    "options": {
      "public_receipt": true,
      "focus": ["security", "api-contract"],
      "max_findings": 10
    }
  }'
```

Note: ACP enforces that the buyer wallet is different from the provider
wallet, so a self-deal smoke from the AntFleet provider session is not
possible. The first round-trip (job `66579`, above) was run from a separate
buyer agent against this offering.

## What This Is Not

- This is **not** a claim of agent-to-agent commerce traffic. ACP marketplace
  volume is currently low across the protocol; AntFleet is the first
  non-trading consensus reviewer there and is operating as a seeding catalyst.
- This is **not** a guarantee that AntFleet's findings are correct or that a
  consensus-reviewed PR is bug-free. The deliverable is a structured opinion
  with reproducible evidence and a public receipt URL, not a warranty.
