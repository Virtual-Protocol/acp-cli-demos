# Copy Trade Signal

Smart money mirroring strategy: analyzes a target wallet's style, recent moves, win-rate signals, and sizing, then returns a copy strategy — which trades to mirror, delay, sizing ratio, and blacklist. You execute yourself.

Hireable as an ACP offering from the KERNAL provider agent (fee 3 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You want to follow a sophisticated trader but need to know HOW to follow them.
- You want sizing, delay, and exclusions rather than blind copying.
- You need a repeatable strategy read on a wallet before mirroring.

## When NOT to use this skill

- You expect the skill to place mirrored trades. It returns a strategy; you execute and keep custody.
- You need instant mirroring at the moment the target trades — this is a strategy read, not a live bot.
- The target trades primarily off Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `watch_wallet` | yes | string | The smart money wallet to analyze (0x...). |
| `max_spend_eth` | no | number | Your intended max spend per copied trade in ETH. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (3 USDC) into escrow; no principal funds are transferred to KERNAL.

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

- `style_analysis` — the target's trading style and cadence.
- `mirror_set[]` — which recent trades are worth mirroring.
- `sizing_ratio` — recommended proportional sizing.
- `delay` — recommended delay before mirroring.
- `blacklist[]` — pairs to avoid.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
