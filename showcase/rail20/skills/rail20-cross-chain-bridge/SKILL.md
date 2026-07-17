---
name: rail20-cross-chain-bridge
description: Move value privately across chains via RAIL20 - either the direct Base <-> Robinhood router (Relay/Across quotes) or NEAR Intents 1Click to Arbitrum, BNB Chain, and Ethereum. Withdraw from a shielded pool on one chain and receive value at any destination address on another, with no observable link between source and destination.
---

# RAIL20 Cross-Chain Private Bridge

## Overview

Use this skill when an agent needs to move value from one chain's private balance to a destination address on a different chain. RAIL20 supports two bridge paths:

- **Direct router** (Base <-> Robinhood): the CLI queries competing quotes from Relay and Across, picks the best, and executes an approve + deposit sequence on a burner. Fast, sub-minute settlement.
- **NEAR Intents 1Click** (Base or Robinhood -> Arbitrum, BNB, Ethereum): a swap-and-bridge intent that quotes and settles via a solver. Poll `/api/intent-status` for completion (~1-6 min).

Both paths route through a fresh random burner so the source pool exit and the destination transfer are on-chain unlinkable. Failure recovery works identically to the private swap skill: run `rail20 recover` to sweep any stranded burner.

Three modes are supported:

- **Live execution**: run `rail20 bridge` end to end and poll status until SUCCESS.
- **Quote-only**: return the best available quote for a proposed bridge without executing.
- **Evidence review**: verify a claimed bridge landed at the destination with the expected amount.

## Mode Selection

1. Use **live execution mode** when the destination address, amount, source pool, and destination chain are all within the operating policy.
2. Use **quote-only mode** when the user asks for a fee/rate estimate before committing.
3. Use **evidence review mode** when the user provides source-chain tx hashes and destination-chain tx hashes and asks whether the bridge fully settled.

## Required Rules

- Only bridge to policy-approved chains and destinations. Never invent a destination.
- Minimum bridge is ~2.02 stablecoin units (fee guard: flat 1 + 0.35%). Never attempt smaller.
- On any error, run `rail20 recover --chain <source chain>` before any retry.
- Wait for status SUCCESS before treating a bridge as complete. REFUNDED or FAILED means funds returned to the private balance on the source chain; report and stop.
- Solver capacity can be tight: after a bridge shows SUCCESS, wait at least 60 seconds before the next bridge on the same route. Longer intervals (5 min) if the policy specifies.
- Never bridge more than the per-tx cap. Split large amounts into multiple bridges within the daily cap.
- Robinhood RPC caveat: if `--chain rh` commands fail with "could not detect network", set `RAIL20_ROBINHOOD_RPC` before retrying.

## Stop Conditions

Stop and ask the user before proceeding if any of these occur:

- Destination chain or destination address is not in the policy.
- Requested amount is below ~2.02 (fee guard) or above the per-tx cap.
- Private balance in the source pool is less than the requested amount plus fee.
- Latest bridge on the same route shows REFUNDED or FAILED and the user has not cleared it.
- `rail20 latest` reports a newer version and the policy pins bridge-quote fixes to a specific version.

## Command Pattern

```bash
# check supported destinations
rail20 assets

# quote-only (no execution)
# (via HTTP for now; CLI wrappers may exist depending on version)
curl -X POST https://rail20-api.fly.dev/api/bridge/quote \
  -H "Content-Type: application/json" \
  -d '{"signature":"0x...","fromAsset":"base_usdc","toAsset":"arb_usdc","amount":"5","dry":true}'

# direct router: Base <-> Robinhood
rail20 bridge rh_eth 0xRECIPIENT 0.01 --from eth --chain base       # Base -> Robinhood ETH
rail20 bridge rh_usdg 0xRECIPIENT 3 --from usdc --chain base        # Base USDC -> Robinhood USDG
rail20 bridge rbase_eth 0xRECIPIENT 0.01 --from eth --chain robinhood
rail20 bridge rbase_usdc 0xRECIPIENT 3 --from usdg --chain robinhood

# 1Click intents: out to L1/L2s
rail20 bridge arb_usdc 0xRECIPIENT 2.5                              # Base USDC -> Arbitrum USDC
rail20 bridge bsc_usdt 0xRECIPIENT 5                                # Base USDC -> BNB USDT
rail20 bridge eth_usdc 0xRECIPIENT 3                                # Base USDC -> Ethereum USDC

# recovery on any bridge failure
rail20 recover --chain base
rail20 recover --chain rh
rail20 recover --chain all
```

Raw HTTP flow (both paths):

```
# quote
POST /api/bridge/quote           { signature, fromAsset, toAsset, amount, dry? }
POST /api/router/quote           { signature, fromAsset, toAsset, amount }   # Base <-> RH only

# execute (router path)
POST /api/router/execute         { signature, fromAsset, toAsset, amount, recipient }
                                  -> returns ordered txs[] (approve + deposit) for the burner

# execute (1Click path)
POST /api/swap                    { signature, fromAsset, toAsset, amount, recipient }
                                  -> returns depositAddress + intentId

# poll status (1Click)
GET  /api/intent-status?depositAddress=0x...  -> PENDING | SUCCESS | REFUNDED | FAILED
```

## Destination Reference

| Destination code | Meaning | Source pool typically |
| --- | --- | --- |
| `rh_eth` | Robinhood ETH | Base ETH |
| `rh_usdg` | Robinhood USDG | Base USDC |
| `rbase_eth` | Base ETH | Robinhood ETH |
| `rbase_usdc` | Base USDC | Robinhood USDG |
| `arb_usdc` | Arbitrum USDC | Base USDC or Robinhood USDG |
| `bsc_usdt` | BNB Chain USDT | Base USDC or Robinhood USDG |
| `eth_usdc` | Ethereum USDC | Base USDC or Robinhood USDG |

Run `rail20 assets` for the authoritative live list.

## Workflow (Live Execution Mode)

1. Read the bridge request: source chain, source pool, destination code, destination address, amount.
2. Verify against policy: allowed source, allowed destination, per-tx cap, daily cap, allowed recipient.
3. Confirm private balance in the source pool: `rail20 balance --pool <src> --chain <chain> --wait`.
4. Optional: get a fresh quote first to preview fees and effective rate.
5. Execute: `rail20 bridge <dest> <recipient> <amt> --from <src> --chain <chain>`.
6. For direct router (Base<->RH), the CLI blocks until settlement (seconds to a minute).
7. For 1Click intents, poll `/api/intent-status` until SUCCESS, REFUNDED, or FAILED. Timeout policy: 15 min per bridge unless the user specifies longer.
8. On REFUNDED or FAILED: report to user, run `rail20 recover --chain <source>` as a safety sweep, and stop.
9. On SUCCESS: log source tx, destination tx (or intent id), amount out, effective rate.
10. If another bridge is queued, wait the policy cool-off (60s minimum) before the next.

## Workflow (Quote-Only Mode)

1. Read the proposed bridge parameters.
2. Return a quote via `/api/bridge/quote` with `dry: true` (or `/api/router/quote` for Base<->RH).
3. Present: expected fee, expected output, effective rate, expected settlement time, route (router vs 1Click).
4. Do not execute. Explicitly note the quote is a snapshot and market conditions can shift by the time of execution.

## Workflow (Evidence Review Mode)

1. Confirm the source-chain tx: private withdraw from the pool to a burner.
2. Confirm the burner-owned bridge tx: for router, an approve + deposit on the router contract; for 1Click, a transfer to the intent deposit address.
3. Confirm the destination-chain tx: recipient received the expected amount minus fee within slippage.
4. If any step is missing, run `rail20 recover --chain <source>` and report which step failed.
5. Return `pass`, `fail`, or `uncertain` with the exact missing tx.

## Final Answer

In live execution mode, state:
- Whether the bridge SUCCEEDED, REFUNDED, or FAILED.
- Source chain, destination chain, and destination code.
- Amount sent, amount received at destination, effective rate.
- Route used (direct router or 1Click), and the total settlement time.
- Tx hashes: private withdraw on source, bridge tx on burner, destination tx (or intent id and status).
- Any recovery step taken and its outcome.

In quote-only mode, return the quote block and note that market conditions can move.

In evidence review mode, return `pass`, `fail`, or `uncertain` with the specific evidence gap.

## References

- Agent integration docs: https://docs.rail20.org/agents
- Operating your agent (cross-chain rebalancer policy): https://docs.rail20.org/agents/operating
- Protocol source: https://github.com/rail20dev/protocol
- CLI package: https://www.npmjs.com/package/@rail20/cli
