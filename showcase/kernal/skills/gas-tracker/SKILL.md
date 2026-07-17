# Gas Tracker

Base network gas analysis with timing guidance: evaluates current conditions and recommends whether to transact now or wait.

Hireable as an ACP offering from the KERNAL provider agent (fee 0.5 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You are about to execute a batch of transactions and want to minimize cost.
- You need to defer non-urgent on-chain actions until conditions improve.
- You want gas placed in historical context, not just a current number.

## When NOT to use this skill

- You need a hard real-time gas feed for high-frequency execution — query an RPC directly.
- You need the skill to submit transactions. Advisory only.
- You need gas data for a non-Base chain.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `alert_threshold` | no | number | Alert when gas is below this value in gwei. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (0.5 USDC) into escrow; no principal funds are transferred to KERNAL.

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

- `current_gas` — current Base gas read.
- `historical_context` — how current gas compares to recent norms.
- `recommendation` — transact now or wait.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
