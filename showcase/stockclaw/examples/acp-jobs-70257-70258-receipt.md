# Paid job proof

Two real jobs, run against the live StockClaw agent on Base mainnet (chain
8453), paid in real USDC, settled and verified by direct RPC reads (not CLI
output alone). The second job was handled end to end by the unattended
orchestrator (`src/orchestrator.ts`) with no manual CLI calls on the provider
side, to prove the automation works and not just the manual walkthrough.

Wallets (truncated):

- Provider (StockClaw): `0x3f7f...1d0a`
- Buyer (StockClaw Buyer, test): `0xd3f1...c30f`

## Job #70257 — BTC, manual walkthrough

Offering: `btc_market_state_report`. Requirement sent before the `symbol`
field was added to the requirements schema, so this job used the
offering-name-implies-asset path (the original design, since replaced).

| Step | Timestamp (UTC) | Event |
|---|---|---|
| 1 | 2026-07-22T19:25:08.100Z | `job.created` |
| 2 | 2026-07-22T19:25:11.582Z | requirement message: `{"timeframe":"4h"}` |
| 3 | 2026-07-22T19:27:56.280Z | `budget.set` — 0.5 USDC |
| 4 | 2026-07-22T19:28:19.878Z | `job.funded` — 0.5 USDC |
| 5 | 2026-07-22T19:28:50.208Z | `job.submitted` — deliverableHash `0xd550686c703fda994f84ac2cb60a4c102bc4dd215b8e1205d6c6a8f61414f9fa` |
| 6 | 2026-07-22T19:29:13.807Z | `job.completed` — tx `0x342b384d79d9e4f296732e1cec63711c0df02a612d00cf9fcc8fa3155d054662` |

Deliverable summary: `stockclaw.market-state/v1`, symbol `BTCUSDT`, timeframe
`4h`, entry_score 60 (neutral band), live_model_reference direction BUY at
0.4396 probability against a 0.45 execution threshold (`would_trader_act:
false`).

## Job #70258 — ETH, fully autonomous

Offering: `eth_market_state_report`, requirement `{"symbol":"ETH",
"timeframe":"1h"}` against the current requirements schema (`symbol` is a
required, `const`-pinned field per offering). Every provider-side step below
was taken by `src/orchestrator.ts` polling `acp job list --all --json` on a
15s interval — nothing was run by hand except the buyer-side `create-job`,
`fund`, and `complete` calls, which is what a real external buyer would do.

| Step | Timestamp (UTC) | Event | Actor |
|---|---|---|---|
| 1 | 2026-07-22T19:38:20.041Z | `job.created` | buyer (manual) |
| 2 | 2026-07-22T19:38:25.692Z | requirement message: `{"symbol":"ETH","timeframe":"1h"}` | buyer (manual) |
| 3 | 2026-07-22T19:38:43.736Z | `budget.set` — 0.5 USDC | **orchestrator (autonomous)** |
| 4 | 2026-07-22T19:39:05.587Z | `job.funded` — 0.5 USDC | buyer (manual) |
| 5 | 2026-07-22T19:39:45.655Z | `job.submitted` — deliverableHash `0xb68993d35b4f2692694fc695ca2ec103898ed8ed47a7ab4fac5418b3fca5c69a` | **orchestrator (autonomous)** |
| 6 | 2026-07-22T19:40:41.787Z | `job.completed` — tx `0xd3721c8ebcc664c6cc98fceb7951cbba4e805cbe10e2c603b596fa1e61a8bf56` | buyer (manual) |

Orchestrator log for this job:

```
[orchestrator] poll: 1 job(s) visible
[orchestrator] job 70258: setting budget 0.50 USDC
[orchestrator] poll: 1 job(s) visible
[orchestrator] poll: 1 job(s) visible
[orchestrator] job 70258: building deliverable for {"symbol":"ETH","timeframe":"1h"}
[orchestrator] job 70258: submitting deliverable (entry_score=56)
[orchestrator] job 70258: submitted.
```

Deliverable summary: `stockclaw.market-state/v1`, symbol `ETHUSDT`, timeframe
`1h`, entry_score 56 (neutral band), live_model_reference direction BUY at
0.5492 probability against a 0.45 execution threshold (`would_trader_act:
true`).

## Settlement verification (on-chain, not CLI-reported)

Provider USDC balance on Base mainnet, read directly via `eth_call` against
the USDC contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), `balanceOf`
selector `0x70a08231`:

| Point | Balance |
|---|---|
| Before either job | 0 USDC |
| After job #70257 | 0.45 USDC |
| After job #70258 | 0.90 USDC |

Each job priced at 0.50 USDC settles 0.45 USDC to the provider (the
difference is protocol fee), consistent across both jobs. Both increments
were confirmed with a fresh RPC call after each completion, not inferred from
`acp` command output.

## What this proves

- The deliverable schema (`DELIVERABLE_SCHEMA.md`) round-trips real data
  end to end for two different assets and two different timeframes.
- The unattended orchestrator correctly reads `onChainJobId` / `jobStatus`
  from `job list`, extracts the requirement message from `job history`, and
  drives `provider set-budget` / `provider submit` without operator input.
- Funds move for real, on Base mainnet, and settle to the provider wallet —
  confirmed independently of the CLI, by reading the chain directly.
