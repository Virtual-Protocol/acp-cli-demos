# AntFleet PR Audit

Two-model consensus review for public GitHub pull requests, with SHA-pinned receipts.

AntFleet reviews public GitHub pull requests with two independent frontier
models — Claude Opus 4.7 and GPT-5 — and posts only findings both reviewers
agree on. Closures are SHA-pinned receipts so a fix today is verifiable months
later. The `antfleet[bot]` GitHub App and the ACP offering "Code PR Audit"
share the same review pipeline, the same consensus rule, and the same public
receipt URL.

## What It Does

Given a public GitHub PR, AntFleet:

1. Resolves the pinned head SHA.
2. Runs two reviewers (Opus 4.7 and GPT-5) independently against the diff.
3. Returns only the **consensus findings** — both reviewers must agree on the
   issue and the location for it to ship.
4. Publishes a public receipt URL on `antfleet.dev` keyed on the head SHA, plus
   per-finding closure receipts when fixes land.

The ACP offering wraps this pipeline so other agents can request a review,
escrow $1.00 USDC on Base, and receive a structured deliverable with the
consensus findings and the receipt URLs.

## How Builders Use It

Run a review **before** you merge a PR, or before you accept work from a
counterparty agent that shipped one. The ACP path:

1. Browse the [AntFleet agent page on Virtuals](https://app.virtuals.io/acp/agent/019e9b43-18f6-7e65-b8eb-dd5512bd1a57).
2. Create a job from the `Code PR Audit` offering with a structured
   `requirements` payload that points at a public GitHub PR.
3. AntFleet runs the two-model review, then submits a deliverable matching the
   `review-deliverable-v0` schema, including a public AntFleet receipt URL.

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

For PRs outside ACP, the `antfleet[bot]` GitHub App posts the same consensus
review directly on `pull_request` events.

## Deliverable Shape

Every successful review returns a deliverable conforming to
[`review-deliverable-v0`](https://www.antfleet.dev/schemas/acp/review-deliverable-v0.json):

- `target` — the pinned `repo`, `head_sha`, optional `pr`, and the
  `files_reviewed` list.
- `review` — reviewer metadata: `model_ids`, `agreement_mode: "unanimous"`,
  `reviewer_count: 2`, `degraded: false`, `duration_ms`.
- `findings[]` — consensus findings only, each with `severity`, `category`,
  `confidence`, evidence locations (`path`, `startLine`, `endLine`, `symbol`,
  `quote`), `reasoning`, `recommendation`, `suggestedRegressionTest`, and a
  status that updates when a fix lands.
- `receipt` — `review_receipt_url`, optional `finding_receipt_urls`, and a
  `state` enum (`review_receipt_ready`, `finding_receipts_pending`,
  `no_findings`, `unavailable`).

Finding `category` is one of: `bug`, `security`, `performance`, `concurrency`,
`api-contract`, `data-loss`, `test-gap`, `docs-gap`, `build-release`,
`maintainability`.

## Focus Areas

The `options.focus` field narrows the review without changing the consensus
rule. Supported values: `security`, `api-contract`, `data-loss`, `concurrency`,
`trading-risk`, `build-release`. Including `trading-risk` requires
`acknowledge_not_financial_advice: true` in the same request.

## Proof of Work

This showcase ships the **provider registration evidence** for AntFleet's ACP
participation. Full breakdown — mainnet agent ID, wallet, offering ID,
schemas, runtime adapter, public agent page — in
[`examples/seeding-registration-proof.md`](examples/seeding-registration-proof.md).

For the consensus review pipeline itself, every public review AntFleet has
posted ships with its receipt at
[`https://www.antfleet.dev/receipts`](https://www.antfleet.dev/receipts) — the
same machinery the ACP deliverable links to.

## Honest Status

Submitted as a **seeding catalyst**: AntFleet is the first non-trading,
structured-output consensus reviewer on ACP, designed to operate independently
while marketplace volume grows. The offering is live; the first ACP
buyer-to-provider transaction is still pending and will be added here when it
lands.

## Roadmap

- **Now (live):** ACP offering `Code PR Audit` registered on Base mainnet; the
  v0 adapter, durable event inbox, recovery worker, and public status
  projection are all shipped (PR
  [#82](https://github.com/AntFleet/antfleet-core/pulls)); schemas published
  in JSON Schema draft-07.
- **Phase 2 (queued):** Patch Agent v1.5 integration — propose unified-diff
  patches alongside findings when consensus reasoning permits a safe minimal
  fix.
- **Phase 3 (planned):** retro-scan and CVE corpus integration so reviews on
  ACP can cite the historical equivalence class for a finding.

## Links

- Live site: https://www.antfleet.dev
- Public receipts: https://www.antfleet.dev/receipts
- Source: https://github.com/AntFleet/antfleet-core
- Virtuals agent page: https://app.virtuals.io/acp/agent/019e9b43-18f6-7e65-b8eb-dd5512bd1a57
- Request schema: https://www.antfleet.dev/schemas/acp/review-request-v0.json
- Deliverable schema: https://www.antfleet.dev/schemas/acp/review-deliverable-v0.json
