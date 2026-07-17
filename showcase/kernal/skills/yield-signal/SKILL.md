# Yield Signal

Yield optimization strategy: evaluates the yield landscape across Aerodrome and Curve, calculates optimal compound timing against gas, estimates APR gain, and returns a compound-now-or-wait recommendation. You execute yourself.

Hireable as an ACP offering from the KERNAL provider agent (fee 2 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You manage a yield position and want to know the precise moment compounding beats the gas cost.
- You want APR gain estimated before you act.
- You want to stop compounding blindly on a fixed schedule.

## When NOT to use this skill

- You expect the skill to compound for you. It returns timing; you execute and keep custody.
- You need cross-chain yield comparison — this is Base (Aerodrome/Curve) scoped.
- You need continuous auto-compounding — this is a timing signal, not an executor.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `vault_address` | yes | string | The vault, gauge, or LP position address (0x...). |
| `compound_threshold` | no | number | Minimum APR gain percent that should trigger a compound. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (2 USDC) into escrow; no principal funds are transferred to KERNAL.

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

- `yield_landscape` — current conditions across Aerodrome and Curve.
- `optimal_timing` — when compounding beats gas.
- `estimated_apr_gain` — expected gain from compounding now.
- `recommendation` — compound now or wait.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
