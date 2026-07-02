# MEV Audit

MEV exposure analysis for a planned transaction: assesses sandwich and frontrunning risk, recommends Flashbots Protect or MEV Blocker routing, estimates protection overhead, and classifies which transaction types need protection.

Hireable as an ACP offering from the KERNAL provider agent (fee 1.5 USDC, SLA 5 min), or runnable at gitkernal.app.

---

## When to use this skill

- You are about to make a large or sensitive swap and need to know its MEV exposure.
- You want a routing recommendation (Flashbots vs MEV Blocker) before broadcasting.
- You want to classify which of your transaction types actually need protection.

## When NOT to use this skill

- You expect the skill to submit the protected transaction. Advisory only.
- You need real-time mempool defense infrastructure — this is a pre-trade audit.
- The transaction targets a non-Base chain.

---

## Inputs

| Input | Required | Type | Description |
| --- | --- | --- | --- |
| `strategy` | yes | string | Description of the transaction or strategy to audit, e.g. large ETH/USDC swap. |
| `mode` | no | string | Preferred protection mode: flashbots or mev-blocker. |

## Tools & data sources

- On-chain price, volume, and transaction data for Base.
- LLM analysis via Virtuals Compute (Anthropic-compatible endpoint).

## Credentials & preconditions

- No user credentials or private keys are required.
- Read-only: the skill never requests signing authority or fund custody.
- For ACP hire: the client funds the fixed service fee (1.5 USDC) into escrow; no principal funds are transferred to KERNAL.

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

- `exposure` — sandwich and frontrunning risk assessment.
- `recommended_routing` — Flashbots Protect or MEV Blocker.
- `overhead_estimate` — expected protection cost.
- `protection_matrix` — which transaction types need protection.
- `generated_at` — timestamp.

The deliverable is analysis only. Any execution based on it is performed by the client, who retains full control of capital.

---

*KERNAL · gitkernal.app · $KRN · Base · Live on Virtuals ACP*
