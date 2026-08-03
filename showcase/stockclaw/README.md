# StockClaw — Market State Reports on ACP

StockClaw (stockclaw.holostudio.io) is a market-intelligence terminal that
scores crypto assets on five specialist reads — chart, on-chain flow,
derivatives, sentiment, and risk — and blends them into one Entry Score per
candle. This showcase sells that same read to other agents, per job, on the
Agent Commerce Protocol.

## ACP Provider

StockClaw runs a live ACP **Provider** poller (systemd service, 15s poll
interval). It does not browse the job board — it publishes six offerings and
waits to be hired, then:

1. **Read** the funded job's requirement (symbol, optional timeframe).
2. **Price** it via `setBudget` — every offering is a flat $0.50.
3. **Fetch** the read from the same `/api/v2/market-state` endpoint the public
   terminal calls, for that symbol and timeframe.
4. **Submit** a signed JSON envelope (`session.submit`).
5. **Settle** — escrow releases to StockClaw's wallet on client approval.

### Offerings

| Offering | Price | Delivers |
|---|---|---|
| `btc_market_state_report` | $0.50 | BTC Entry Score + 5-desk read + live model reference |
| `eth_market_state_report` | $0.50 | ETH Entry Score + 5-desk read + live model reference |
| `sol_market_state_report` | $0.50 | SOL Entry Score + 5-desk read + live model reference |
| `avax_market_state_report` | $0.50 | AVAX Entry Score + 5-desk read + live model reference |
| `xrp_market_state_report` | $0.50 | XRP Entry Score + 5-desk read + live model reference |
| `doge_market_state_report` | $0.50 | DOGE Entry Score + 5-desk read + live model reference |

Each offering fixes its asset in the requirements schema (`symbol` is a
required, `const`-pinned field), so a job created against `btc_market_state_report`
can only ever be requested for BTC. `timeframe` (`1h` / `4h` / `1d`, default
`4h`) is the only buyer choice.

### Deliverable contract

Every deliverable is `stockclaw.market-state/v1`, the same shape the free
terminal renders, reshaped into a protocol envelope:

```json
{
  "schema": "stockclaw.market-state/v1",
  "symbol": "BTCUSDT",
  "timeframe": "4h",
  "generated_at": "2026-07-22T19:28:33Z",
  "source": "stockclaw.holostudio.io",
  "entry_score": {
    "value": 60,
    "band": "NEUTRAL",
    "meaning": "Weighted confluence of the rule set over the indicators computed this cycle. Describes the CURRENT market state, not a price forecast.",
    "rules_evaluated": 28,
    "rules_supporting": 7,
    "rules_opposing": 2,
    "rules_neutral": 19
  },
  "indicator_summary": { "computed": 28, "trend": { "stance": "neutral", "agreement": 0.38 } },
  "desk_notes": {
    "chart": "Strong bullish Supertrend (6.8% above); Bullish AO (1205.47)",
    "onchain": "BTC chain: fee 3 sat/vB · mempool 86,351 (0.2h)",
    "derivatives": "OI $6.76B, funding +0.001%, top-trader long 61%",
    "sentiment": "Fear & Greed 33/100 (Fear); news 21 bull / 18 bear (48h)",
    "risk": "no extreme risk flags; Price in middle of BB; No ATR data"
  },
  "live_model_reference": {
    "note": "Separate model trained specifically on this asset (4H bars), the same one driving an autonomous trader on company capital only. A reference, never an override.",
    "direction": "BUY",
    "class_probabilities": { "BUY": 0.4396, "HOLD": 0.2508, "SELL": 0.3096 },
    "execution_threshold": 0.45,
    "would_trader_act": false
  },
  "disclaimer": "Informational only. Not financial advice. Read-only: nothing in this deliverable moves funds or places an order. Model weights, rule thresholds, and feature definitions are not included."
}
```

The full delivered payload for a real job is committed at
`examples/acp-deliverable-70258.json`.

### Proof — two completed on-chain jobs

`examples/acp-jobs-70257-70258-receipt.md` is the receipt of **two real,
completed** buys on Base mainnet:

```
19:25:08  job.created       buyer 0xd3f17f93… → provider 0x3f7f53cb…    (BTC, 4h)
19:25:11  requirement       {"timeframe":"4h"}
19:27:56  budget.set        amount = 0.5 USDC
19:28:19  job.funded        amount = 0.5 USDC
19:28:50  job.submitted     deliverableHash 0xd550686c…414f9fa
19:29:13  job.completed     tx 0x342b384d…d054662

19:38:20  job.created       buyer 0xd3f17f93… → provider 0x3f7f53cb…    (ETH, 1h)
19:38:25  requirement       {"symbol":"ETH","timeframe":"1h"}
19:38:43  budget.set        amount = 0.5 USDC     — orchestrator, unattended
19:39:05  job.funded        amount = 0.5 USDC
19:39:45  job.submitted     deliverableHash 0xb68993d3…fca5c69a  — orchestrator, unattended
19:40:41  job.completed     tx 0xd3721c8e…61a8bf56
```

The second job's `budget.set` and `job.submitted` steps were taken entirely
by the unattended provider poller — no manual CLI calls on the provider side.
Provider wallet USDC balance, read directly from the Base USDC contract (not
from CLI output): 0 → 0.45 → 0.90 across the two settlements, matching the
$0.50 price minus the protocol fee both times.

## Architecture

```
              stockclaw.holostudio.io (public terminal)
                 42-rule engine · 99-feature model
                            │
                 /api/v2/market-state  (same endpoint, both surfaces)
                            │
              ┌─────────────┴─────────────┐
              │   ACP provider poller      │
              │   (systemd, 15s interval)  │
              │                            │
              │  list jobs → read req      │
              │  → setBudget → fetch       │
              │  → submit → settle (USDC)  │
              └─────────────┬──────────────┘
                            │ escrow release
                            ▼
                StockClaw wallet 0x3f7f53cb…
```

## Guardrails

- **Read-only.** Every offering returns a market-state report; nothing here
  moves a buyer's funds or places a trade.
- **No secret sauce.** Buyers receive the same aggregate output-level data
  the free terminal already shows every visitor: an Entry Score, five desk
  summaries, and a model's class probabilities. Rule weights and thresholds,
  the 99 engineered feature definitions, model hyperparameters, and the live
  trader's actual positions and balance are never included.
- **Honest framing.** Every deliverable carries the same disclaimer as the
  public terminal: informational only, not financial advice.
- **Self-describing jobs.** Each offering's requirement schema pins its own
  `symbol`, so a job is unambiguous from its requirement message alone —
  the provider never has to guess which asset a job is for.

## Build info

- **Chain:** Base (8453)
- **ACP agent wallet:** `0x3f7f53cbaf6bf93d800f8f6aae5ed40265941d0a`
- **ACP SDK/CLI:** `@virtuals-protocol/acp-node-v2`, `@virtuals-protocol/acp-cli`
  (provider poller shells out to the CLI's already-authenticated signer)
- **Provider runtime:** Node/TypeScript, systemd user service, polling
  `acp job list --all --json` every 15s
- **Backing service:** StockClaw's existing `ml-service` `/api/v2/market-state`
  endpoint — the same one the public terminal renders
