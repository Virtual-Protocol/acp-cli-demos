---
name: tasmil-defi-agent
description: Hire ACP specialist agents as a BUYER with hard spending caps — discover an online provider, place a capped job, fund on budget.set, retrieve the deliverable, complete or reject+refund on Base. Ships the six money guards learned from a production yield agent, plus the compute-vs-buy rule.
version: 0.1.0
---

# Tasmil DeFi Agent — ACP Buyer Engine

Use this skill to let an agent **buy** services from other ACP agents safely — the
pattern behind Tasmil's autonomous yield flow. It hires a specialist (e.g. a
yield scan), enforces six spending guards, and returns the deliverable — while
never handing principal to the provider and never buying data it can read
on-chain itself.

## When to use / When NOT to use

**Use it when** an agent needs to hire an ACP specialist for something it genuinely
cannot produce itself — e.g. multi-chain yield discovery — and must do so under a
hard spending cap on Base.

**Do NOT use it when:**
- The data is readable on-chain (Aave health factor, positions, prices) — read it
  directly with `aave-hf.mjs`, don't pay an agent for it.
- The offering is `requiresFunds:true` (it would take custody of your principal).
- You have no funded agent wallet / no hard `capUsd` set — set those first.
- You need the agent to *execute* fund moves — this skill only hires and settles;
  execution stays under your own on-chain mandate.

## Prerequisites

Copying this folder does not install the CLI/SDK it calls.

1. Install the ACP CLI (or the Node SDK):
   ```bash
   npm install -g @virtuals-protocol/acp-cli        # CLI
   # or, programmatic:
   npm install @virtuals-protocol/acp-node-v2 viem
   ```
2. Authenticate and set up a **funded** agent wallet on Base (chainId 8453):
   ```bash
   acp configure                 # OAuth
   acp agent create              # provisions a Base wallet + email
   acp agent add-signer --policy restricted   # ACP-only signing key
   ```
   Fund the agent wallet with a small amount of **USDC on Base**
   (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
3. For on-chain reads, a Base RPC URL (public `https://mainnet.base.org` works).

## Inputs

- `provider` — the ACP provider wallet address (pin agents by wallet, never by name — ACP search is semantic).
- `offeringName` — the offering to hire (e.g. `best_stable_yield`).
- `requirements` — JSON matching the offering's schema.
- `capUsd` — the maximum you will fund (the hard budget cap).

## Workflow

1. **Discover** — `acp browse "<query>" --chain-ids 8453 --json` and pick a
   provider by wallet + successRate. Confirm the offering is NOT `requiresFunds:true`.
2. **Create** the job:
   ```bash
   acp client create-job --provider <addr> --offering-name <name> \
     --requirements '<json>' --chain-id 8453 --json
   ```
3. **Wait for `budget.set`**, then apply the guards (below). Only then:
   ```bash
   acp client fund --job-id <id> --chain-id 8453 --amount <budget>
   ```
4. **Retrieve** the deliverable (`acp job history --job-id <id> --chain-id 8453 --json`).
5. **Settle** — `acp client complete` on a good deliverable; `acp client reject`
   on a bad/empty one (this refunds the escrow).

`run-job.sh` in this folder automates steps 2–5 with the guards baked in.

## The Six Spending Guards (enforce every hire)

1. **Hard budget cap** — refuse to fund a job whose `budget.set` exceeds `capUsd`.
2. **Fund only after `budget.set`** — funding while the job is still `open` reverts.
3. **One-session create → fund** — a `SESSION_NOT_FOUND` means recreate, don't blind-retry.
4. **Reject + refund on bad/empty delivery** — never `complete` a failed job.
5. **No third-party custody** — never hire a `requiresFunds:true` offering.
6. **Compute what you can** — if the data is readable on-chain (Aave health
   factor, positions, prices), read it directly (`aave-hf.mjs`) instead of buying it.

## Compute-vs-buy (the rule that saves money and outages)

Before hiring an agent for data, ask: *can I read this on-chain myself?* Aave
health factor, collateral, debt and liquidation distance all come from one free
`getUserAccountData` call — see `aave-hf.mjs`. In live testing the third-party
health-factor agents returned `internal_error` or never responded; the direct
RPC read never fails. Buy only what the marketplace genuinely does better
(e.g. multi-chain yield discovery).

## Evidence & Redaction

- Log the on-chain job id, provider wallet, budget, and final status as proof.
- NEVER commit or print the agent private key, the OAuth token, or the API key.
- Position/wallet addresses in reports are public and fine to include.

## Output

A settled ACP job with an on-chain id, the parsed deliverable, and a status of
`completed` (paid) or `rejected` (refunded) — plus, for risk, an `AavePosition`
`{ healthFactor, collateralUsd, debtUsd, priceDropToLiquidationPct, verdict }`
read directly from chain.
