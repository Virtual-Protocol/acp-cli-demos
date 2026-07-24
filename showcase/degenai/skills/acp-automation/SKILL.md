# ACP Automation (DegenAI)

Create and run **custom trigger-based trading automations** on **DegenAI** over
Virtuals ACP. Define a strategy in natural language; DegenAI evaluates the
conditions on a loop and places HyperLiquid orders when they fire.

## When to use

- You want a persistent, condition-driven strategy (not a one-shot order):
  "buy the dip if BTC 4h RSI drops below 30", "trail a stop as price rises",
  "close half the position when it's up 20%".
- You need to create, inspect, top up, or stop automations owned by a wallet,
  over ACP.

## When NOT to use

- You just want a single immediate order. Use the trade-execution skill instead.
- The trading wallet has not approved a DegenAI agent link or holds less than
  $10 USDC free margin. Resolve authorization/margin first.
- You are not authorized to spend real funds. A live automation places real
  orders on a live exchange whenever its condition fires.

## Capabilities exposed by DegenAI over ACP

- `automation_info` - system metadata: supported assets, valid intervals,
  trigger types, resource limits, and pricing. Call this before creating so you
  build a valid rule.
- `automation_create` - create a rule from natural-language conditions and
  actions. Requires trading authorization. Bundles 1000 LLM evaluation checks.
- `automation_list` - list every rule for the wallet with its state, asset,
  condition, and the shared evaluation-check balance.
- `automation_status` - a single rule's live state: last check result, trigger
  configuration, and recent execution logs.
- `automation_evaluate` - run one evaluation on demand; charged only for the
  actual LLM usage it consumes.
- `automation_manage` - start, stop, or delete a rule. Stop pauses evaluation
  without deleting; delete removes it.
- `automation_topup` - add 1000 evaluation checks to the wallet's shared
  balance.

## Billing model

- Evaluation "checks" are a per-wallet balance shared across all of that
  wallet's automations. `automation_create` bundles 1000; `automation_topup`
  adds 1000 more; `automation_evaluate` charges for actual usage.
- The rule's trades themselves settle on HyperLiquid under the wallet's
  approved DegenAI agent - the same authorization used for one-shot execution.

## Credentials and preconditions

- The wallet must have approved a DegenAI agent link (one Butler agent per
  wallet).
- Free margin >= $10 USDC per order the automation will place (HyperLiquid
  minimum notional).
- Call `automation_info` first to confirm supported assets, intervals, and
  trigger types before creating.

## Approval gates (spending / production mutations)

- A live automation places real orders whenever its condition fires, without a
  human in the loop at fire time. The submitting agent MUST have explicit human
  or policy approval for the strategy and its notional before creating the rule.
- Per-wallet and per-asset automation caps are enforced before payment settles;
  a rule that would exceed a cap is rejected rather than created.

## Stop conditions and handoff

- Stop if trading is not authorized, margin is insufficient, or the asset /
  interval / trigger type is unsupported (checked via `automation_info`) - hand
  the setup / top-up link back to the caller.
- To halt a running strategy, call `automation_manage` with stop (pause) or
  delete. Stopping is reversible; deleting is not.

## Validation and output contract

- `automation_create` returns the rule id, state (active / armed / paused), the
  resolved trigger and next check time, and the remaining evaluation-check
  balance.
- `automation_evaluate` returns condition met / not met, the reasoning, and any
  action taken (including on-chain fill details when it places a trade).
- On failure: `errorCode` and `errorMessage`, no silent partial state.

## Example job

> "Create an automation on ETH 1h: if RSI closes below 30, buy $50 at market
> with a stop-loss 3% below entry. Check every closed 1h candle."

DegenAI validates authorization and margin, creates the rule with a candle-close
trigger, and returns the rule id, its armed trigger, the next check time, and
the evaluation-check balance. When the condition later fires, it places the
order and records on-chain fill proof.
