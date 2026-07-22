---
name: acp-attention-market-signal
description: Expose a prediction / attention market as an agent-to-agent signal business over ACP. Model each market (e.g. a KOL battle) as a priced offering, price a funded job from a fixed catalog, fetch live odds/volume/mindshare from your own market surface, and submit one signed deliverable envelope so a buyer integrates once regardless of which market it bought. Use when you run a live prediction/attention market and want other agents to pay for its structured signals.
---

# ACP Attention Market Signal

A reusable playbook for turning a **live prediction / attention market** into an
agent-to-agent signal business over the Agent Commerce Protocol (ACP), without
exposing the market's internal pricing engine. De9en uses it to sell the odds,
volume, and mindshare outputs of its KOL Wars battles; the pattern generalizes to
any market that produces public, read-only quotes.

## When To Use

- You already run a **live** market surface (odds, volume, ranking) and want
  buyers — human-run or autonomous agents — to pay for its structured outputs.
- You want each tradable question (a KOL battle, a binary market) to be an ACP
  **offering** that a buyer agent can discover, fund, and integrate against.
- You want one stable deliverable so a buyer integrates once and reuses it across
  every market you list.

## When NOT To Use

- The market isn't live yet. Sell real quotes, not placeholders.
- The deliverable would leak the pricing engine (AMM curve constants, internal
  liquidity routing, private order flow). Sell **outputs**, not the recipe.
- The action isn't read-only. This pattern sells *information*; it must never move
  a buyer's funds or place a position on their behalf.

## Prerequisites

- A live market surface you control that returns, per market, at least:
  `yesOdds`, `noOdds`, `volume`, and a `mindshareRank` (the source of truth for
  every deliverable).
- A fixed, published offering catalog that maps each market to a price.
- `acp-cli` configured with the active provider agent, for the ACP rail.
- A server-side credential for your market API (never shipped in a deliverable).

## Core principle — one deliverable envelope, many markets

Define the deliverable **once** as a stable signed envelope and return it for
every market, so a buyer integrates a single shape:

```json
{
  "signal": "kol-battle-odds",
  "market": "<market-slug>",
  "source": "<your agent> (<your domain>)",
  "delivered_at": "<ISO-8601>",
  "disclaimer": "Informational only — not financial advice.",
  "data": {
    "question": "<the market question>",
    "yes": { "label": "<side A>", "odds": 0.0, "volume": "..." },
    "no": { "label": "<side B>", "odds": 0.0, "volume": "..." },
    "mindshare_rank": 0,
    "as_of_block": null
  }
}
```

Every offering fetches from the same market surface and wraps it in the same
envelope, so payment rail and market choice never change the integration.

## ACP Provider flow

Publish offerings, then run a poller (cron, ~60s) that reacts to jobs:

1. **Hydrate** open jobs; read the requirement message (which market + signal).
2. **Resolve + price** the offering from the fixed catalog → `setBudget(price)`.
   Keep catalog prices and code in lockstep; resolve market slugs
   case-insensitively so listing drift can't orphan a paid job.
3. On `job.funded`, **fetch** the live quote from your market surface
   (server-only credential) and **submit** the signed envelope.
4. **Idempotency:** rely on the ACP state machine; make submit safe to retry.
5. Escrow releases to your wallet when the buyer approves.

Buyer flow (for your docs / a test):

```bash
acp client create-job --provider <your-wallet> \
  --offering-name kol-battle-odds --requirements '{"market":"<slug>"}' --chain-id <id>
acp client fund     --job-id <id> --amount <price> --chain-id <id>
acp client complete --job-id <id> --chain-id <id> --reason verified
```

## Guardrails

- **No fabricated proof.** Back every "it's live" claim with an inspectable
  surface — the public market page, a share/OG card, or a completed job receipt.
- **No secret sauce in deliverables.** Ship the quote outputs; never embed the
  AMM curve, liquidity routing, or resolution heuristics.
- **Honest framing.** Every deliverable carries a disclaimer; descriptive odds
  are labelled descriptive, never presented as guaranteed directional alpha.
- **Redact.** No keys, signer material, secrets, or account credentials in any
  offering, deliverable, or artifact. Wallet addresses and tx hashes only.
- **Server-side gate.** Enforce access on the server (ACP escrow state); never
  gate purely client-side. Serve gated payloads `no-store`.

## Validation checklist

- [ ] Each offering in the catalog maps to exactly one market slug and price.
- [ ] The same envelope shape is returned for every market.
- [ ] Market slugs resolve case-insensitively; catalog prices match code.
- [ ] Deliverables carry the disclaimer and no private methodology.
- [ ] Gated responses are `no-store`; no secrets in any public artifact.

## Output contract

A buyer receives the signed envelope above. `data` is the live quote for the
requested `market`; `signal`, `market`, `source`, `delivered_at`, and
`disclaimer` are always present so integration is identical across markets.
