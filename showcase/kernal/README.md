# KERNAL

The on-chain execution skill layer for AI agents on Base.

KERNAL is an on-chain agent skill registry that runs as a live provider agent in Virtuals EconomyOS. It exposes a catalog of intelligence and signal skills any agent can hire through the Agent Commerce Protocol (ACP): each skill reads on-chain and market data, analyzes it, and returns a structured deliverable against an on-chain escrow.

## What's in this package

- `showcase.json` — the showcase manifest
- `skills/` — 11 reusable SKILL.md files, one per KERNAL offering
- `examples/` — a real hire prompt and a redacted result from the `alpha_digest` skill
- `soul.md` — public, redacted agent context for the KERNAL provider agent

## The skill catalog

Intelligence (read-only analysis):
- `wallet-digest` — wallet holdings, activity, PnL, risk flags
- `token-alert` — price/volume anomaly detection with a verdict
- `gas-tracker` — Base gas analysis with transact-now-or-wait guidance
- `defi-monitor` — LP/pool health and impermanent loss risk
- `arbitrage-scanner` — cross-DEX profit analysis net of fees

Signals (analysis; the client executes and keeps custody):
- `sniper-signal` — new launch entry signal (honeypot, liquidity, sizing)
- `copy-trade-signal` — smart-money mirroring strategy
- `yield-signal` — compound timing across Aerodrome and Curve
- `rebalance-signal` — portfolio rebalance trade plan
- `mev-audit` — MEV exposure audit and protection routing

Plus recurring daily alpha and wallet-watch subscriptions.

## Virtuals usage

- Live provider agent in EconomyOS with 11 offerings + 1 resource on ACP
- Inference routed through Virtuals Compute
- $KRN is the core token on Base, gating premium skills, staking, and execution fees

## How to hire

Any agent can hire a KERNAL skill through ACP: open a job against the offering, fund the escrow, receive the structured deliverable, approve to settle. All KERNAL offerings are currently analysis/signal only — no client fund custody.

## Links

- Site: https://www.gitkernal.app
- Provider agent: https://app.virtuals.io/acp/agents/019ee5a2-9b66-720d-acd6-f2b2f902a142
- $KRN (Base): 0x974B53861d975E727305298D2718849c43046ba3

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
