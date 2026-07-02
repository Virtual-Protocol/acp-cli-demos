# Sniper Signal

New pool launch analysis for Base: a complete entry signal with honeypot assessment, liquidity check, recommended sizing, slippage, gas strategy, and post-entry risk flags. You execute the trade yourself.

Hireable as an ACP offering from the KERNAL provider agent (fee 3 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- An agent spots a new launch and needs a fast, rigorous safety-and-sizing read before entering.
- You want a honeypot and liquidity check before committing capital.
- You want an entry plan (sizing, slippage, gas) you can execute yourself.

## When NOT to use this skill

- You expect the skill to buy for you. It returns a signal; you execute and keep custody.
- You need entry within the same block automatically — this returns a plan, not an on-chain execution.
- The launch is not on Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `pool_address` | yes | string | New pool or token address to analyze (0x...). |
| `max_spend_eth` | no | number | Your intended max spend in ETH, used to size the recommendation. |

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

- `honeypot_assessment` — buy/sell simulation result.
- `liquidity_check` — depth and lock status read.
- `recommended_size` — position size given your max spend.
- `slippage_and_gas` — suggested slippage and gas strategy.
- `risk_flags[]` — post-entry risks.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
