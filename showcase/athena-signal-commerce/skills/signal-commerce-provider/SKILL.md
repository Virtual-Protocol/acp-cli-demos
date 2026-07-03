---
name: signal-commerce-provider
description: Monetize a gated signal or data API as an autonomous agent over two rails — an ACP Provider poller (escrowed per-job sales) and an x402-gated MCP server (zero-value holder-proof free tier plus 1-USDC pay-per-call) — sharing one signed deliverable contract. Use when you have a working data/signal endpoint and want to sell its outputs agent-to-agent on Base.
---

# Signal Commerce Provider

A reusable playbook for turning a **gated data/signal API** into an
agent-to-agent business over two payment rails at once, without duplicating the
data layer. Athena uses it to sell Hyperliquid smart-money, Wisdom-ranking, and
liquidation signals; the pattern generalizes to any read-only data product.

## When To Use

- You already have a **working** data/signal endpoint (the "brain") and want
  buyers — human-run agents or autonomous ones — to pay for its outputs.
- You want **both** an escrowed marketplace channel (ACP) and a low-friction
  per-call channel (x402), without maintaining two separate data pipelines.

## When NOT To Use

- The product isn't live yet. Sell real outputs, not placeholders.
- The deliverable would leak private methodology (model weights, thresholds).
  Sell **outputs**, not the recipe.
- The action isn't read-only. This pattern is for selling *information*; it must
  not be able to move a buyer's funds or place trades.

## Prerequisites

- A gated data endpoint you control (the source of truth for every deliverable).
- A funded agent wallet on Base and a tokenized agent identity (for ACP + the
  optional holder gate).
- `acp-cli` configured with the active provider agent, for the ACP rail.
- An MCP-capable worker/host and an x402 facilitator (e.g. Coinbase CDP), for the
  x402 rail.

## Core principle — one deliverable contract, two rails

Define the deliverable **once** as a stable envelope and serve it on both rails:

```json
{
  "signal": "<tag>",
  "source": "<your agent> (<your domain>)",
  "delivered_at": "<ISO-8601>",
  "disclaimer": "Informational only — not financial advice.",
  "data": { "...": "the live payload from your gated endpoint" }
}
```

Both rails fetch from the same gated endpoint and wrap it in the same envelope,
so a buyer integrates once regardless of how they paid.

## Rail 1 — ACP Provider poller

Publish offerings, then run a poller (cron, ~60s) that reacts to jobs:

1. **Hydrate** open jobs; read the requirement message.
2. **Resolve + price** the offering from a fixed catalog → `setBudget(price)`.
   Keep catalog prices and code in lockstep; resolve offering names
   case-insensitively so listing drift can't orphan a paid job.
3. On `job.funded`, **fetch** the deliverable from your gated endpoint
   (server-only credential) and **submit** the signed envelope.
4. **Idempotency:** rely on the ACP state machine; make submit safe to retry.
5. Escrow releases to your wallet when the buyer approves.

Buyer flow (for your docs / a test):

```bash
acp client create-job --provider <your-wallet> \
  --offering-name <offering> --requirements '{}' --chain-id 8453
acp client fund     --job-id <id> --amount <price> --chain-id 8453
acp client complete --job-id <id> --chain-id 8453 --reason verified
```

**Always land one real completed job** and keep the receipt (lifecycle + hashes +
settlement) — it is the only proof that buyers can actually purchase.

## Rail 2 — x402-gated MCP server

Expose the same signals as read-only MCP tools; keep discovery open, gate only
`tools/call`:

- **Holder path (free):** require a **zero-value** USDC EIP-3009 authorization
  signature. It proves wallet ownership and settles nothing — recover the signer,
  then check the token balance (support ERC-1271/6492 smart wallets). Cache the
  balance check briefly.
- **Pay-per-call:** accept x402 (v1 `X-PAYMENT` and v2 `PAYMENT-SIGNATURE`), a
  fixed price per call, settled through a facilitator. Return the settlement
  receipt header on success.
- Publish a **public catalog** (`/info`) and a **health** endpoint so the gate
  status (`paid_path: true`) and tool list are inspectable.
- Rate-limit per wallet / per IP / global; serve gated responses `no-store`.

## Guardrails

- **No fabricated proof.** Back every "it's live" claim with an on-chain receipt,
  a live health endpoint, or the public catalog.
- **No secret sauce in deliverables.** Ship outputs; never embed the model.
- **Honest framing.** Carry a disclaimer; label descriptive signals as
  descriptive, not guaranteed alpha.
- **Redact.** No keys, signer material, secrets, or account credentials in any
  offering, deliverable, or artifact. Wallet addresses and tx hashes only.
- **Server-side gate.** Enforce access on the server for both rails; never gate
  purely client-side.

## Validation checklist

- [ ] One completed ACP job receipt captured (lifecycle, deliverable hash, settlement).
- [ ] `/health` reports the pay path enabled; `/info` lists tools + access + limits.
- [ ] The same envelope is returned on both rails for the same signal.
- [ ] Catalog prices match code; offering names resolve case-insensitively.
- [ ] Gated responses are `no-store`; rate limits enforced.
- [ ] No secrets or private methodology in any public artifact.

## Output contract

A buyer — on either rail — receives the signed envelope above. `data` is your
live payload; `signal`, `source`, `delivered_at`, and `disclaimer` are always
present so integration is identical across rails.
