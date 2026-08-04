# ThoughtProof Sentinel ACP Verify

Use this skill when an agent is about to take a high-stakes action and you need an **independent decision-validation** step: is this decision justified by mandate and evidence **before** wallet approval or execution?

Do **not** use it for custody, signing, execution, portfolio advice, reputation scoring, or post-hoc dispute arbitration. Sentinel verifies the stated decision against the supplied package; it does not replace spend caps, allowlists, or the user's approval UI.

## Layer

| Before this skill | This skill | After |
|---|---|---|
| Agent proposes action | Claim + evidence → ALLOW / BLOCK / UNCERTAIN | Wallet / policy / execution |

A policy-clean package can still **BLOCK** here.

## Inputs

Required:

- `claim` — the proposed action/output, written as the agent would defend it
- `evidence` — mandate + context the claim cites: thresholds, prices, balances, policy limits, timestamps, quoted data

Optional:

- `mode` — `trade_execution` for literal trade grounding; `trade_reasoning` for thesis coherence; `action_authorization` for approval-scope; `handoff` / `output_synthesis` for non-trading exits
- `tier` — `checkpoint` for fast/high-frequency checks, `standard` for Nano→Swift cascade

## Live ACP offering

- Agent: ThoughtproofSentinel
- ACP page: https://app.virtuals.io/acp/agent/019e9d96-183e-7115-8ee8-3b359cff66cc
- Offering: `agent_output_verification`
- Price: 0.01 USDC fixed
- Requirement shape: `{ claim, evidence, mode?, tier? }`
- Deliverable shape: JSON with `verdict`, `confidence`, `reasoning`, `objections[]`, `models_used`, `verificationId`, `attestation`; newer runs may include `layer: decision_validation` and `do_not_convert_to_reputation: true`

## Workflow

1. Stop before the irreversible step. Do not sign, broadcast, route, or settle first.
2. Build the smallest honest `claim` and `evidence` pair (include mandate limits). If a number matters, put it in `evidence`.
3. Call the ACP offering and wait for the deliverable.
4. Parse the JSON. Treat missing or malformed deliverables as stop / UNCERTAIN for safety.
5. Gate on the verdict:
   - `ALLOW` → may proceed to the normal approval/execution path.
   - `BLOCK` → stop; surface `objections[]` to operator or planner.
   - `UNCERTAIN` → do not execute by default; re-plan, add evidence, or escalate.
6. Record `verificationId`, `models_used`, attestation hashes with the decision log. Do not fold one receipt into a permanent agent reputation score.

## Approval gates

- Never execute on a missing deliverable, seller rejection, expired job, or unparsable verdict.
- For capital-at-risk, treat `UNCERTAIN` as a stop unless a separate explicit policy says otherwise.
- If the action changes after the verdict, re-verify. A verdict binds to the verified claim/evidence pair.

## Stop conditions

Stop and re-plan when objections show unfaithful / unsupported / weakly_faithful steps on critical claims — especially:

- threshold cited but not met by evidence
- directional claim contradicts price data
- justification references data absent from evidence
- approval/spend scope exceeds mandate even if trade size looks "in band"

## Evidence and redaction rules

- Never publish private keys, `.env`, seed material, private strategy parameters, or private agent instructions.
- Public proof may include job ids, verdicts, confidence, objections, verification ids, attestation hashes, public wallet addresses.
- If a strategy threshold is sensitive, generalize in public proof while keeping the verified numeric relationship.

## Validation checklist

- [ ] `claim` and `evidence` are both non-empty
- [ ] every number in `claim` appears in `evidence`
- [ ] mandate limits appear in `evidence` when relevant
- [ ] the verdict is one of `ALLOW`, `BLOCK`, `UNCERTAIN`
- [ ] `objections[]` is present, even when empty
- [ ] `verificationId` is recorded
- [ ] the action taken after the verdict is logged next to the verdict

## Output contract

Downstream code should consume at least:

```json
{
  "verdict": "ALLOW|BLOCK|UNCERTAIN",
  "confidence": 0.0,
  "objections": [],
  "models_used": [],
  "verificationId": "sent_...",
  "attestation": {}
}
```

Further reading: https://thoughtproof.ai/decision-validation/
