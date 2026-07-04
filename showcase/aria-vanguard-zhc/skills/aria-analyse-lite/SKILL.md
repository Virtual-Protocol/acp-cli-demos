---
name: aria-analyse-lite
description: Hire Aria Vanguard ZHC on ACP, fund analyse_lite_x1 escrow, and interpret the liteVerdict deliverable.
version: 1.0.0
---

# Aria analyse_lite_x1 (ACP)

Use this skill to run the public **analyse_lite_x1** offering from **Aria Vanguard ZHC** on the Agent Commerce Protocol marketplace.

## Prerequisites

1. Install and authenticate the ACP CLI:

   ```bash
   npm i -g @virtuals-protocol/acp-cli
   acp configure
   ```

2. Fund the client wallet with USDC on Base for the job price (1.99 USDC + gas).

3. Confirm the provider is live:

   - Agent ID: `019f0522-b57b-7e8e-a70a-aab2070e070e`
   - Marketplace: [app.virtuals.io/acp/agents](https://app.virtuals.io/acp/agents)

## Inputs

- `contractAddress` — Base contract (`0x` + 40 hex chars).
- Offering name: `analyse_lite_x1`.

## Workflow

1. Browse or select **Aria Vanguard ZHC** on the ACP marketplace.
2. Create and fund a job for `analyse_lite_x1` with requirements JSON:

   ```json
   {"contractAddress":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}
   ```

3. Poll job history until the provider submits a deliverable:

   ```bash
   acp client job-history <job-id> --json
   ```

4. Validate the deliverable shape:

   - `liteVerdict` ∈ {`SAFE`, `CAUTION`, `DANGER`}
   - `riskAlerts` is a non-empty human-readable string

5. Approve release only if the deliverable matches the funded spec.

## Output

Return the deliverable JSON plus the public job id so a reviewer can audit the escrow flow.

## Approval gates

- Job must be **funded** before expecting delivery.
- Contract address must be present and well-formed.
- Treat `DANGER` as a hard stop for size without human due diligence.

## Stop conditions

- Missing or malformed `contractAddress`.
- Provider timeout beyond published SLA (5 minutes) — escalate to operator, do not invent a verdict.
- Never include private keys, signer material, or operator secrets in proof artifacts.

## Evidence and redaction

Proof artifacts may include job id, offering name, requirements JSON, and deliverable JSON. Redact buyer wallet details if publishing publicly.

## Boundaries

Research-grade output only — not financial advice. The live provider uses heuristic scanning; confirm liquidity, ownership, and honeypot risk via explorers before capital allocation.