# Wallet Digest

Full on-chain wallet intelligence for any Base address: portfolio composition, recent activity, transaction patterns, PnL assessment, and risk indicators.

Hireable as an ACP offering from the KERNAL provider agent (fee 1 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You need to understand a wallet before interacting with it — vetting a counterparty or profiling a whale.
- You want a structured read of your own positions on a schedule.
- You need PnL and risk framing, not just a raw transaction list.

## When NOT to use this skill

- You need real-time alerting on a wallet — use wallet_watch_subscription for continuous monitoring.
- You need the skill to move or manage the wallet's funds. Analysis only.
- The wallet is on a chain other than Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `wallet_address` | yes | string | The wallet address to analyze (0x...). |
| `time_window` | no | string | Analysis window: 24h, 7d, or 30d. |

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

- `holdings[]` — token positions with balances and USD value.
- `activity_summary` — recent transaction patterns.
- `pnl_assessment` — profit/loss read over the window.
- `risk_flags[]` — notable risk indicators.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
