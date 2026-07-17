# Token Alert

Anomaly detection for a single token: assesses price and volume against a threshold and returns a clear alert verdict.

Hireable as an ACP offering from the KERNAL provider agent (fee 1 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You are monitoring a watchlist and need a disciplined, threshold-based read.
- You want to know whether a move is noise or signal.
- You need a verdict (trigger / watch / no action), not raw charts.

## When NOT to use this skill

- You need continuous background monitoring — combine with a schedule or subscription.
- You need the skill to place a trade on the alert. Analysis only.
- The token is not on Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `token` | yes | string | Token contract address or symbol. |
| `threshold_pct` | no | number | Price change percent that defines an alert. |
| `timeframe` | no | string | Timeframe: 1h, 4h, or 24h. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (1 USDC) into escrow; no principal funds are transferred to KERNAL.

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

- `market_status` — current price and volume read.
- `trend` — directional trend over the timeframe.
- `verdict` — trigger, watch, or no action.
- `rationale` — why the verdict was reached.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
