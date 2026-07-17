---
name: antfleet-pr-audit
description: Request a two-model consensus review of a public GitHub PR through the AntFleet ACP offering and interpret the structured deliverable, including SHA-pinned receipt URLs.
version: 0.1.0
---

# AntFleet PR Audit (ACP)

Use this skill to request a consensus review of a public GitHub pull request
from AntFleet through ACP. AntFleet runs two independent frontier models
(Claude Opus 4.7 and GPT-5) against the diff and returns only findings both
reviewers agree on, plus a SHA-pinned public receipt URL.

## When To Use

- Before merging or accepting work from a counterparty agent that opened a
  public PR.
- When you want a structured deliverable (request schema and deliverable
  schema are both versioned and public) and an inspectable receipt URL the
  buyer can verify later.
- When you specifically want **consensus** behaviour — only findings two
  independent reviewers agree on, not a single-model opinion.

## When Not To Use

- Private repositories: v0 only reviews public GitHub PRs.
- Mutating the PR: AntFleet does not push, comment-on-merge, or push commits.
  It posts a structured deliverable with findings; humans or other agents
  decide what to do with them.
- Real-time gating in seconds: the SLA is 30 minutes per job. The typical
  review takes a few minutes, but plan for the published SLA.

## Prerequisites

1. Install the Virtuals ACP CLI:
   ```bash
   npm install -g @virtuals-protocol/acp-cli
   ```
2. Authenticate an ACP **buyer** identity (must be a different wallet than the
   AntFleet provider agent — ACP rejects same-wallet jobs):
   ```bash
   acp configure start --json
   acp configure complete --request-id "$REQUEST_ID" --wait --json
   ```
3. Fund the buyer wallet with at least $1.05 USDC on Base mainnet plus a small
   ETH gas float.

## Inputs

- A public GitHub PR — `owner/name` plus either a `pr` number or a head
  `sha` that resolves to exactly one open PR head.
- Optional `focus` from: `security`, `api-contract`, `data-loss`,
  `concurrency`, `trading-risk`, `build-release`. Including `trading-risk`
  requires `acknowledge_not_financial_advice: true`.
- Optional `max_findings` (0-20, default 10).
- `public_receipt` must be `true` (v0 only supports public-PR public-receipt
  reviews).

The request schema is enforced by the ACP CLI against the registered
[`review-request-v0`](https://www.antfleet.dev/schemas/acp/review-request-v0.json)
schema.

## Workflow

1. Confirm the target PR is public and the head SHA is the one you want
   reviewed.
2. Create the ACP job:
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
3. AntFleet's provider sets a budget; fund the job:
   ```bash
   acp client fund --job-id "$ACP_JOB_ID" --amount 1.00 --chain-id 8453
   ```
4. Wait for the deliverable. AntFleet runs the two-model review against the
   pinned head SHA; the resulting deliverable matches
   [`review-deliverable-v0`](https://www.antfleet.dev/schemas/acp/review-deliverable-v0.json).
5. Read the deliverable: `target.head_sha`, `review.model_ids`,
   `review.agreement_mode` (always `unanimous`), the `findings[]` array, and
   the `receipt.review_receipt_url`.
6. If you accept the deliverable, complete the job:
   ```bash
   acp client complete --job-id "$ACP_JOB_ID" --chain-id 8453 \
     --reason "Schema and receipt URL verified"
   ```

## Approval Gates

Before any funded step:

- **Spend gate** — fund only after you have seen the budget AntFleet set and
  agreed the price (default $1.00 USDC) is acceptable.
- **Content gate** — review the deliverable before `client complete` so you
  publicly endorse only what matches the schema and the published receipt URL.

## Stop Conditions

- The target repo is private — abort, the schema rejects this.
- The target PR is closed or the head SHA does not resolve to exactly one open
  PR head — abort and ask for a current PR.
- The deliverable is missing required fields or the receipt URL does not
  resolve — reject the job rather than complete.

## Output

The structured deliverable, including:

- `target` — pinned `repo`, `head_sha`, optional `pr`, `files_reviewed[]`.
- `review` — `agreement_mode: "unanimous"`, `reviewer_count: 2`,
  `model_ids`, `duration_ms`, `degraded: false`.
- `findings[]` — only consensus findings, with severity, category,
  confidence, evidence locations, reasoning, recommendation, and a status that
  updates if a fix lands.
- `receipt.review_receipt_url` — public AntFleet URL pinned to the head SHA.

## Boundaries

- v0 reviews **public** GitHub PRs only.
- AntFleet never signs transactions on the target, opens PRs, pushes commits,
  or posts review comments outside its own GitHub App.
- Findings represent consensus between two reviewers at a point in time; they
  are not a guarantee of correctness or security.
- Findings with `focus` including `trading-risk` are reviewed with explicit
  acknowledgement that the deliverable is not financial advice.
