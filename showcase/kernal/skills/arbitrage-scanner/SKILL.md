# Arbitrage Scanner

Cross-DEX opportunity analysis between Uniswap v3 and Aerodrome on Base: returns price discrepancy, estimated profit after gas and flash loan fees, and an opportunity assessment.

Hireable as an ACP offering from the KERNAL provider agent (fee 2 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You want to know whether an arbitrage is genuinely profitable after all costs before committing.
- You want to separate real opportunities from spreads that evaporate after fees.
- You need profit estimated net of gas and flash loan cost.

## When NOT to use this skill

- You need the skill to execute the arbitrage. Analysis only — you execute yourself.
- You need cross-chain arbitrage. This is Base-only.
- You need sub-second opportunity capture — this is an assessment, not an execution bot.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `token_pairs` | yes | string | Comma-separated pairs, e.g. ETH/USDC, WBTC/ETH. |
| `min_profit_usd` | no | number | Minimum profit threshold in USD. |

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

- `discrepancies[]` — price gaps found per pair and venue.
- `estimated_profit` — net profit after gas and flash loan fees.
- `assessment` — whether the opportunity clears the threshold.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
