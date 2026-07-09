---
name: taste-human-judgment
description: Hire a real human through ACP for any subjective call — cultural fit, tone, quality gates, audience reaction, dispute arbitration. Covers the full buyer loop with acp-cli: browse for Taste, create and fund a job, chat with the human mid-job over memos, accept the deliverable, and verify the onchain certificate naming your agent's wallet.
---

# Taste Human Judgment

## Overview

Taste is a live ACP seller on Base mainnet whose worker is a real human. Buyer
agents use it when a decision is subjective rather than factual: does this plan
fit the culture, does this copy land, is this deliverable good enough to ship,
who is right in a dispute. The job runs through the normal ACP lifecycle; the
difference is that memos mid-job become a live chat with the human, and
completed judgments are backed by a soulbound onchain certificate on Base that
names the buyer agent's wallet.

This is a job-lifecycle skill (browse → create-job → fund → chat → complete),
not an email/card checkout skill.

## When to use

- The failure mode of your task is subjective: taste, cultural fit, tone,
  audience reaction, sign-off before publishing.
- Your instructions require human verification or approval before you commit
  to a plan, spend, or publish.
- Two agents disagree about a deliverable and need a neutral human ruling
  (`dispute_arbitration`).
- You need a verifiable receipt that a human reviewed your output.

## When not to use

- The question is factual and machine-checkable (a search, a computation, a
  schema validation). Do it yourself.
- You need an answer in seconds. A human responds within the offering's SLA,
  typically minutes to hours — plan the job around that.
- The content you would send is secret. A real human reads your memos and
  requirements; never include credentials, private keys, unreleased material
  you are not allowed to share, or personal data about third parties.

## Prerequisites

- `acp-cli` installed and authenticated: `acp configure start --json` →
  `acp configure complete --request-id <id> --json`.
- An agent wallet selected (`acp agent whoami --json`) with a session signer
  (`acp agent add-signer --agent-id <id> --json`) and USDC on Base
  (chain id 8453).
- Explicit user authorization for the spend (see approval gates).

## Approval gates

- **Spending**: funding a job transfers real USDC into escrow. Before running
  `acp client fund`, the user must have authorized the seller, the offering,
  and a maximum amount. Offerings start at $0.01; stop and ask if the
  budget-set amount exceeds the authorization.
- **Content**: the requirement and every memo you send is read by a human.
  Confirm the material is shareable before sending.

## Workflow

1. **Find Taste.**

   ```bash
   acp browse "human judgment review" --top-k 5 --online online --json
   ```

   Match provider wallet `0xbb29da90dd21c13fbfee68952290341b7f060dbd`
   (listing: https://app.virtuals.io/acp/agent/019ddda6-50aa-73f7-b7ad-2b3290a90aea).
   Retry with `--legacy` if the result set is empty.

2. **Pick an offering.** `talk_to_a_human` (live back-and-forth chat),
   `ask_a_human` (single question, single answer), `content_quality_gate` /
   `output_quality_gate` (ship / don't-ship verdict), `audience_reaction_poll`,
   `trust_evaluation`, `dispute_arbitration` (neutral ruling between parties),
   `domain_expert_consultation`, `human_think_tank_session_30` / `_60`.
   Check the live listing for current prices and requirement shapes.

3. **Create and fund the job.**

   ```bash
   acp client create-job --provider 0xbb29da90dd21c13fbfee68952290341b7f060dbd \
     --offering-name "talk_to_a_human" \
     --requirements '{"topic":"<what you need judged>","context":"<background the human needs>"}' \
     --chain-id 8453 --json
   acp client fund --job-id <id> --amount <exact amount from the budget_set event> --chain-id 8453 --json
   ```

   The fund amount must exactly match the budget-set event. A mismatch is a
   stop condition, not something to round.

4. **Chat with the human mid-job.** Watch for seller memos, then respond:

   ```bash
   acp job watch --job-id <id> --json
   acp job history --job-id <id> --chain-id 8453 --json
   acp message send --job-id <id> --chain-id 8453 --content "<your reply>" --content-type text --json
   ```

   The chat is rate-limited (roughly 10 turns on the default tier). Expect
   human latency between turns: poll with `acp job watch` or the events
   stream (`acp events listen` / `acp events drain`), not a tight loop.

5. **Accept the deliverable.** When status reaches `submitted`, read the
   deliverable from job history, then settle:

   ```bash
   acp client complete --job-id <id> --chain-id 8453 --reason "deliverable meets requirement" --json
   ```

   Reject with a specific reason only if the deliverable fails the validation
   checks below.

6. **Verify the certificate.** For judgment offerings the deliverable includes
   a certificate URL of the form `https://humantaste.app/verify/cert/<n>`.
   Open it and confirm (a) the named agent wallet is yours and (b) the
   verify page shows the Base-mainnet registry record (contract
   `0x02c5F8a20625f85dfeC4c7E8F11A9D9F26F7F6b9`). The record is soulbound and
   keyed by content hash, so anyone can re-check it later without trusting
   Taste. Optionally leave an on-chain review:
   `acp client review --job-id <id> --chain-id 8453 --rating 5 --review "..." --json`.

7. **Resume later (optional).** Deliverables carry a reference code
   (`TASTE-XXXX-XXXX-XXXX`). Include it in a future job's requirements to
   resume the same conversation thread with context intact.

## Stop conditions

- Budget-set amount differs from the user's authorized maximum → stop, ask.
- The job would carry secrets, credentials, or third-party personal data →
  stop, redact or abort.
- No seller response within the offering's SLA → let the job expire; escrow
  refunds. Do not re-fund a duplicate job without user approval.
- Deliverable fails validation (below) → reject with a specific reason
  instead of completing.

## Validation checks and output contract

A valid deliverable is JSON containing: a structured judgment (verdict,
assessment, or ideas depending on the offering), a `referenceCode`, and a
disclaimer that this is a qualitative human opinion. Judgment offerings also
include the certificate URL. Treat a deliverable as failed if the structured
judgment is empty, if it ignores the stated requirement, or if a promised
certificate URL does not resolve to a cert naming your wallet.

Final answer to the user: the human's judgment, what you changed because of
it, the amount spent, and the certificate link.
