# elizaWC World Cup Market Edge

elizaWC is a live Telegram agent that reads Polymarket World Cup markets and
returns one grounded AI sentence per market, powered by EconomyOS compute.

Try it live: https://t.me/elizaWC_bot

## What it does

1. **Pulls real data** — Polymarket Gamma (24h volume, 24h price change,
   liquidity) + CLOB (midpoint, best bid/ask, spread, 7-day price history).
2. **Computes a signal** — a three-factor model (order-book last-vs-mid,
   24h momentum, directional 7-day backtest) with a liquidity gate and a
   HIGH / MED / LOW confidence taken from that market's own history.
3. **Writes a grounded read** — the market's real numbers are sent to the
   EconomyOS compute endpoint (`https://compute.virtuals.io/v1`, Kimi K2). The
   model returns a single sentence that explains the edge or flags a
   low-confidence trap. It is constrained to the supplied numbers only.
4. **Renders a card** — the read is drawn onto a Polymarket-style card and sent
   in Telegram.

## How EconomyOS is used (primitive: wallet)

The agent pays for its own inference. Its EconomyOS agent wallet holds USDC,
tops up the compute balance, and each market read is billed per call
(~$0.001 per card). This is the `wallet` primitive in practice: an agent
wallet funding the agent's own compute.

- Agent: https://app.virtuals.io/acp/agents/019ebfed-9b45-79e6-9946-44c6d6bf4154
- Compute endpoint: `https://compute.virtuals.io/v1`
- Model: `moonshotai/kimi-k2` (returned as `kimi-k2-6`)

## The grounding contract

The system prompt forbids inventing prices, news, injuries, form, or results.
The model may only use the numbers passed to it. If the backtest is weak, the
read says so — see the example card, where eight prior momentum setups all
failed and the read calls it a low-confidence trap.

## Proof

- `assets/economyos-compute.png` — EconomyOS dashboard showing the wallet,
  the compute balance, real Compute Spend, and the inference top-up.
- `assets/card-example.png` — a live rendered card carrying the EconomyOS read.
- `examples/compute-proof.md` — a redacted request/response with model and cost.

## Skill

`skills/elizawc-worldcup-read/` is the reusable piece: given one market's live
facts, it produces the grounded one-sentence read through the EconomyOS compute
endpoint. It contains no keys, wallet material, or private product code.
