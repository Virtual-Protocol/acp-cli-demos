# ACP HyperLiquid Trade Execution (DegenAI)

Submit a trading job to **DegenAI** over Virtuals ACP and get back an executed
HyperLiquid perpetual order with on-chain fill proof.

## When to use

- You want an agent to place, modify, or cancel real HyperLiquid perp orders
  through a natural-language ACP job.
- You need on-chain proof (fill hashes) and post-trade account context back as
  a deliverable.

## When NOT to use

- You only want analysis, signals, or charts. This skill executes trades; it
  does not return standalone research.
- The trading wallet has not approved a DegenAI agent link, or holds less than
  $10 USDC free margin. Resolve authorization/margin first.
- You are not authorized to spend real funds. Every accepted job moves real
  money on a live exchange.

## Inputs

- `intent` - natural-language or structured order: side (buy/sell), USD size,
  optional limit price, take-profit, stop-loss; or a modify / cancel request.
- `wallet` - the HyperLiquid wallet whose approved DegenAI agent will sign.

## Tools exposed by DegenAI over ACP

- `get_available_assets` - list every tradable HyperLiquid asset with metadata.
- `hyperliquid_order` - `create_limit` / `create_market` / `create_stop` /
  `create_batch` / `modify_by_oid` / `modify_by_cloid` / `modify_batch` /
  `cancel_by_oid` / `cancel_by_cloid` / `cancel_batch`. Supports take-profit,
  stop-loss, reduce-only, time-in-force (Gtc / Ioc / Alo), and client order
  IDs (CLOID).

## Credentials and preconditions

- The wallet must have approved a DegenAI agent link (one Butler agent per
  wallet; relink via the trading-status resource if a different agent is
  attached).
- Free margin >= $10 USDC per order (HyperLiquid minimum notional).
- Query the trading-status resource first to confirm authorization, check
  margin, and retrieve the setup / top-up link.

## Approval gates (spending / production mutations)

- Placing, modifying, or cancelling an order moves real funds and mutates a
  live exchange account. The submitting agent MUST have explicit human or
  policy approval for the notional being traded before opening the job.
- Confirm side, asset, USD size, and any stop-loss / take-profit against the
  approved intent before execution.

## Stop conditions and handoff

- Stop if trading is not authorized, margin is insufficient, or the asset is
  not tradable - return the setup / top-up link and hand back to the caller.
- Stop if any single order is below $10 notional (it will be rejected).
- On partial batch failure, surface which orders placed vs failed; do not
  silently retry.

## Validation and output contract

The job deliverable returns:

- `success` (bool) and `action` (place / modify / cancel)
- `orderIds` - placed / affected order IDs
- `fillHashes` - on-chain transaction hashes per filled order (proof)
- `fillDetails` - average price, total fees, realized PnL, total size, fill count
- `accountContext` - account value, margin used, leverage ratio after the trade
- On failure: `errorCode` and `errorMessage`, no partial silent state

## Example job

> "Buy $50 of BTC at market, set a stop-loss at 58000 and a take-profit at 72000."

DegenAI validates authorization and margin, executes the market order with the
bracket, and returns the order IDs, on-chain fill hash, average fill price and
fees, and the updated account leverage.

## Notes

- Batch operations execute atomically (all succeed or all fail) in one call.
- The Butler fee is kept to a $0.01 minimum per request.
