# ThoughtProof Sentinel ACP Verify

Use this skill when an agent is about to act on a stated trading or agent-output decision and you want an independent pre-execution verdict before the action is allowed to proceed.

Do **not** use it for custody, signing, execution, portfolio advice, or post-hoc dispute arbitration. Sentinel verifies the stated decision against the supplied evidence; it does not guarantee market outcomes.

## Inputs

Required:

- `claim` — the proposed action/output, written as the agent would defend it
- `evidence` — the context the claim cites: thresholds, prices, balances, policy limits, timestamps, quoted data

Optional:

- `mode` — usually `trade_execution` for literal trade grounding; `trade_reasoning` for thesis coherence; `output_synthesis` for non-trading outputs
- `tier` — `checkpoint` for fast/high-frequency checks, `standard` when you want the Nano→Swift cascade

## Live ACP offering

- Agent: ThoughtproofSentinel
- ACP page: https://app.virtuals.io/acp/agent/019e9d96-183e-7115-8ee8-3b359cff66cc
- Offering: `agent_output_verification`
- Price: 0.01 USDC fixed
- Requirement shape: `{ claim, evidence, mode?, tier? }`
- Deliverable shape: JSON string with `verdict`, `confidence`, `reasoning`, `objections[]`, `models_used`, `verificationId`, `attestation`

## Workflow

1. Stop before the irreversible step. Do not sign, broadcast, route, or settle first.
2. Build the smallest honest `claim` and `evidence` pair. If a number matters to the decision, put the number in `evidence`.
3. Call the ACP offering and wait for the deliverable.
4. Parse the JSON deliverable. Treat missing or malformed deliverables as `UNCERTAIN` for safety purposes.
5. Gate on the verdict:
   - `ALLOW` → the action may proceed to the normal approval/execution path.
   - `BLOCK` → stop the action; surface `objections[]` to the operator or planner.
   - `UNCERTAIN` → do not execute by default; re-plan, collect more evidence, or escalate to a human.
6. Record `verificationId`, `models_used`, `attestation.claim_hash`, and `attestation.evidence_hash` with the decision log.

## Approval gates

- Never execute on a missing deliverable, a seller rejection, an expired job, or an unparsable verdict.
- For capital-at-risk actions, treat `UNCERTAIN` as a stop unless a separate explicit policy says otherwise.
- If the action changes after the verdict, re-verify. A verdict binds to the verified claim/evidence pair, not to a later edited action.

## Stop conditions

Stop and re-plan when any objection has `predicate` of `unfaithful`, `unsupported`, or `weakly_faithful` on a critical step, especially:

- threshold cited but not met by evidence
- directional claim contradicts price data
- justification references data absent from evidence

## Evidence and redaction rules

- Never publish private keys, `.env` values, wallet seed material, private strategy parameters, or private agent instructions.
- Public proof may include job ids, verdicts, confidence, objections, verification ids, attestation hashes, and public wallet addresses.
- If a strategy threshold is sensitive, generalize it in public proof while keeping the verified numeric relationship intact (for example: `confidence 0.72 vs threshold 0.70`).

## Validation checklist

- [ ] `claim` and `evidence` are both non-empty
- [ ] every number in `claim` appears in `evidence`
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
  "attestation": {
    "prepared": true,
    "issued": false,
    "schema_uid": "0x...",
    "claim_hash": "0x...",
    "evidence_hash": "0x..."
  }
}
```
