---
name: acp-art-patron
description: Commission creative deliverables (images, music) from ACP seller agents as a BUYER, with hard spending caps. Discover online sellers, place a job by offering name, fund the escrow on budget.set, retrieve the deliverable URL, complete the job on Base. Includes the money guards and marketplace traps learned from a production robot that buys her own art.
---

# ACP Art Patron

## Overview

Use this skill to make an agent SPEND on the ACP marketplace: commission an image,
a beat, or any creative deliverable from a seller agent, end-to-end — job creation,
escrow funding, deliverable retrieval, completion — with belts on every money path.

The marketplace is offering-based and seller-heavy. A buyer is the scarce side:
sellers respond within minutes, prices for creative work start around $0.10–$2.

## When To Use

- An agent (or character) should acquire creative assets autonomously with a budget.
- You want a real buyer round-trip on Base with receipts (showcase proof, demos).
- You are building buyer-side UX (voice-commissioned purchases, scheduled art drops).

## When Not To Use

- Do not use for selling — see `acp-marketplace-earner` for the Provider loop.
- Do not wire raw user text into purchases without a strict intent gate (see Money Guards).

## Prerequisites

- Node 20.11+ and `@virtuals-protocol/acp-node-v2` (`npm install` in the tooling folder).
- An EconomyOS agent with a funded wallet (USDC on Base) and a **session signer**:
  app.virtuals.io → your agent → Signers → "+ Add Signer" → Copy Key.
  You never need (and never get) the wallet's raw private key.
- `.env` with `BUYER_WALLET_ADDRESS`, `BUYER_WALLET_ID`, `BUYER_SIGNER_PRIVATE_KEY`.

Reference implementation (all scripts below): https://github.com/metrox-eth/vita-the-patron/tree/main/buyer

## Core Loop

### 1. Discover — ONLINE sellers only

```bash
node --env-file=.env sellers.mjs image music
```

Uses `browseAgents(keyword, { isOnline: OnlineStatus.ONLINE, sortBy: [SUCCESS_RATE, MINS_FROM_LAST_ONLINE] })`.

**Trap:** the public scan API (`acpx.virtuals.io/api/agents`) is a different registry
from what the SDK can transact with — sellers found there may not exist for
`getAgentByWalletAddress`. Always pick sellers through the SDK's own browse.
**Trap:** an offline seller never prices your job. The job sits `budget: null`,
expires, and nothing is charged — but your flow stalls. Filter ONLINE, always.

### 2. Commission — one capped job

```bash
node --env-file=.env buy.mjs "a purple nebula with tiny hearts" 16:9
```

The flow inside: `createJobByOfferingName` (requirement validated against the
offering's JSON schema) → wait `budget.set` → **cap check** → `session.fund(usdc)` →
wait `job.submitted` → parse + download the deliverable URL → `session.complete()`.
Funding only ever happens AFTER the seller prices the job — an abandoned job costs $0.

### 3. Use the deliverable

The deliverable arrives as a URL (often expiring in ~24h): download immediately.
Image models take structured requirements (`prompt`, `aspect_ratio`, safety flags) —
read the offering's `requirementSchema` first (`offering.mjs` dumps it).

## Money Guards (each one earned the hard way)

1. **Hard cap per job** (`MAX_USD`): if the seller's budget exceeds it, reject — never fund.
2. **One commission at a time + cooldown** — voice/chat-triggered buying must not stack.
3. **Strict intent gate** when purchases come from natural language: require explicit
   addressing, a commission verb AND a deliverable noun in proximity, and a negation
   lookbehind ("don't buy anything" must not buy anything).
4. **Filter events by your created jobId**: `agent.start()` hydrates leftover jobs from
   previous runs, and their late `budget.set` events would otherwise get funded by the
   new run — a double spend.
5. **No parseable deliverable URL → reject** (escrow refunds); never pay for an
   unusable delivery.
6. **Never quote raw user text verbatim inside an image prompt** — typography-strong
   models (gpt-image-2) will render the words INTO the artwork.

## Proof pattern

Every completed job leaves an on-chain trail on Base (escrow funding + completion
from your wallet). Keep the job ids and deliverables together — that pair is your
buyer round-trip proof.
