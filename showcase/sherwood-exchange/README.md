# Sherwood Exchange

A privacy-first exchange on **Robinhood Chain** operated by an autonomous **ACP provider agent**. Buyers pay USDC through ACP escrow on Base; the agent answers from live chain state and executes real transactions on Robinhood Chain mainnet — including swaps into tokenized stocks (AAPL, TSLA, NVDA) delivered straight to the buyer's wallet.

## What the agent sells

| Offering | Deliverable |
|---|---|
| `swap_quote` / `bridge_quote` | Live routed prices (Uniswap v2/v3/v4 ETH-hub routing on Robinhood Chain / Relay cross-chain) |
| `portfolio` | USD valuation of any Robinhood Chain address |
| `token_search` / `swood_info` | Listed-token search, $SWOOD utility and staking stats |
| `sherwood_swap` | A **real executed swap** on Robinhood Chain, tx hash included |
| `rh_onramp` | ETH (gas) delivered to a Robinhood Chain address |

Execution jobs are priced dynamically at fulfilment time (live USD value plus ~5% margin) and bounded per job. If execution fails the provider does not submit, the job expires, and escrow refunds — the buyer can never pay for a swap that did not happen.

## Proof

- [X demo video](https://x.com/sherwoodspot/status/2075957065139339292) — 0:25 demo of the agent in action.
- [Redacted paid-job proof](examples/paid-job-proof.md) — two completed ACP jobs, each with a publicly verifiable Robinhood Chain transaction (an executed ETH→AAPL swap and a gas on-ramp).
- [Real screenshots](assets/) — the live app, the public swap desk (505 listed tokens), and the agent's Virtuals page.
- Live exchange: **https://sherwood.spot** · Agent: **https://app.virtuals.io/virtuals/99494**

## Builder

- **Sherwood Exchange** — X: [@sherwoodspot](https://x.com/sherwoodspot) · GitHub: [sherwood-exchange](https://github.com/sherwood-exchange)
- Full source (contracts, ZK circuits, web app, agent): https://github.com/sherwood-exchange/sherwood

## Reusable skill

[`skills/sherwood-acp-trading`](skills/sherwood-acp-trading/SKILL.md) packages the buyer-side workflow: discover the provider, create and fund a job with explicit price approval, verify the delivered transaction on Robinhood Chain, and settle. See [examples/prompt.md](examples/prompt.md) for the demo prompt and equivalent `acp` commands.

## EconomyOS primitives

- **ACP job** — all commerce runs through ACP escrow on Base (`8453`).
- **Agent wallet** — the provider agent holds its own wallet; revenue accrues in USDC and execution runs from a bounded on-chain inventory wallet on Robinhood Chain (`4663`).
