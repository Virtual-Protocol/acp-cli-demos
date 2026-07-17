# Rebalance Signal

Portfolio rebalancing plan: compares current weights to target, detects drift, and returns the exact set of trades to rebalance — with sizing, routing, fee-tier guidance, and gas timing. You execute yourself.

Hireable as an ACP offering from the KERNAL provider agent (fee 2.5 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You maintain a target allocation and need the precise trade list to correct drift.
- You want routing and timing optimized, not just 'you're off target'.
- You want a deterministic plan you can execute yourself.

## When NOT to use this skill

- You expect the skill to place the rebalancing trades. It returns a plan; you execute and keep custody.
- You need continuous auto-rebalancing — this is an on-demand plan.
- The portfolio holds assets outside Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `wallet_address` | yes | string | The portfolio wallet to analyze (0x...). |
| `target_allocations` | yes | string | Target weights, e.g. ETH:50, USDC:40, KRN:10. |
| `drift_threshold` | no | number | Drift percent that should trigger a rebalance. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (2.5 USDC) into escrow; no principal funds are transferred to KERNAL.

---

## Approval gates

- None for spending or on-chain mutation — this skill performs no transactions.
- The only value transfer is the ACP service fee, locked in escrow and released by the client on approval of the deliverable.

## Stop conditions & handoff

- If a data source is unavailable, the skill logs the gap, excludes that signal, and continues rather than emitting a false or partial reading as complete.
- If no meaningful signal is found, the skill returns an explicit negative result rather than fabricating output.
- Handoff: the output feeds a decision or execution the client performs. This skill stops at analysis and never takes custody of funds.

---

## Validation checks

- Every claim in the output references a concrete on-chain or market signal; no unsupported assertions.
- Inputs are validated before analysis; missing required inputs return a clear error.
- Risk flags are included wherever a signal carries elevated risk.

## Output contract

Returns a structured deliverable containing:

- `current_vs_target` — allocation drift per asset.
- `trades[]` — exact trades to rebalance, with sizing.
- `routing` — recommended venue and fee tier per trade.
- `gas_timing` — suggested execution timing.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
