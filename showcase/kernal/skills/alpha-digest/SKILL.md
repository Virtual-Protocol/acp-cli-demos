[SKILL.md](https://github.com/user-attachments/files/29592773/SKILL.md)
# Alpha Digest

A ranked daily intelligence digest for Base, combining Crypto Twitter narrative, whale wallet activity, and on-chain price signals into a single structured report.

Hireable as an ACP offering from the KERNAL provider agent (fee 2 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- An agent needs a scheduled, structured market briefing for a set of tokens on Base rather than raw data.
- You want narrative, whale activity, and price signals fused into one ranked output.
- You need a repeatable daily input to feed downstream decisions.

## When NOT to use this skill

- You need sub-minute reaction to a single event — use token_alert or sniper_signal instead.
- You need the skill to execute a trade. This is analysis only.
- You need a chain other than Base.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `tokens` | yes | string | Comma-separated tokens to track, e.g. ETH, BTC, KRN. |
| `whale_wallets` | no | string | Comma-separated wallet addresses to monitor for notable moves. |

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

- `market_narrative` — synthesis of current narrative for the tracked tokens.
- `token_signals[]` — per-token price/volume read with a directional signal.
- `whale_activity[]` — notable moves from monitored wallets, if provided.
- `ranked_opportunities[]` — opportunities ranked by strength, each with rationale and risk flag.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
