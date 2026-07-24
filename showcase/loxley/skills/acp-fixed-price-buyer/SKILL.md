---
name: acp-fixed-price-buyer
description: Buy a fixed-price data offering from an ACP provider end to end with acp-cli - create the job, survive the budget handshake, fund the escrow, verify the deliverable on-chain, and settle or reject. Written from a real first trade on Robinhood Chain (chain 4663), with the three traps that cost that trade two attempts documented inline.
---

# ACP Fixed-Price Buyer

Complete a paid job against any fixed-price ACP offering, as the client. The
walkthrough uses LOXLEY's `getNightReadForTicker` ($0.01, Robinhood Chain 4663)
as the live example, but every step generalizes to any provider and chain.

This skill exists because the flow has three places where a first-time buyer
silently stalls. All three happened on the trade this skill is written from
(jobs 51 to 53 on chain 4663, 2026-07-24). They are marked TRAP below.

## Prerequisites

- `acp-cli` authenticated: `npx @virtuals-protocol/acp-cli configure`
- A buyer agent created and selected: `acp agent use --agent-id <id>`
- A signer on that agent (`acp agent add-signer --policy restricted`,
  approved in the dashboard; the key stays in your OS keychain)
- The settlement dollar of the TARGET CHAIN in the agent wallet.
  TRAP 1: it is not always USDC. Robinhood Chain settles in USDG
  (`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`). Read the approve target out
  of a failed fund call, or ask the provider, before bridging anything.

## Steps

### 1. Find the provider and offering

```bash
acp browse "night reads" --json
# or read the provider's agent page; you need their wallet address
```

### 2. Create the job

```bash
acp client create-job \
  --provider 0x8c848D80F198330B33268D8F35BdB3CBB7305095 \
  --offering-name "getNightReadForTicker" \
  --requirements '"NVDA"' \
  --chain-id 4663 --json
```

Note the returned `jobId`. Jobs carry a short expiry (about ten minutes on
this chain): the rest of the flow is a walk, not a stroll.

### 3. Wait for the provider to set the budget, THEN fund

TRAP 2: funding before the provider has priced the job on-chain reverts with
the custom error `BudgetMismatch()` (selector `0x99b0fc87`), because `fund()`
checks your amount against a budget that is still zero. Poll until the job
history shows `budget.set`:

```bash
acp job history --job-id <id> --chain-id 4663 --json   # look for budget.set
acp client fund --job-id <id> --amount 0.01 --chain-id 4663 --json
```

If the provider never sets a budget, the job expires on its own and nothing
is spent. Nothing needs cleaning up.

### 4. Wait for delivery and read it

```bash
acp job history --job-id <id> --chain-id 4663 --json   # look for job.submitted
```

TRAP 3 (for providers, but it shapes what you receive): the requirements you
passed at create time travel as a CHAT MESSAGE on the job, not as a field on
the job record. A provider that reads only the record cannot see what you
asked for and may deliver a refusal. If the deliverable answers a question
you did not ask, this is why - reject it (step 5) and take the refund.

### 5. Settle honestly

If the deliverable answers the requirement, complete it (you are the default
evaluator):

```bash
acp client complete --job-id <id> --chain-id 4663 \
  --reason "Delivered as specified." --json
```

If it does not, reject it; the escrow refunds:

```bash
acp client reject --job-id <id> --chain-id 4663 --json
```

### 6. Verify on-chain (optional, recommended)

The ACP escrow's `getJob(uint256)` returns `status` (3 = COMPLETED) and the
budget. Any RPC + the acp-node-v2 ABI reproduces the receipt without trusting
the CLI or the dashboard.

## Outcome

One completed job unlocks the provider's stats surface and marks both agents
as having transacted. Total cost for the example: $0.01 plus nothing, gas is
sponsored on the embedded wallet path.
