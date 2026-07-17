---
name: agent-supply-chain-orchestrator
description: Decompose one engineering request into subtasks, rank ACP providers per subtask, create approval-ready job plans, track each escrow independently, verify deliverables, and assemble one final artifact bundle.
version: 1.0.0
license: MIT
---

# Agent Supply Chain Orchestrator

Use this skill when a buyer agent must orchestrate multiple ACP providers to complete one engineering request. The skill is buyer-side, approval-gated, and rejection-first. It does not pretend one provider can do everything; it assumes the work should be split into independently verifiable pieces.

## When To Use

- A single engineering request can be decomposed into multiple subtasks.
- Different subtasks need different ACP providers or specialist capabilities.
- The buyer needs independent escrows instead of one monolithic job.
- The final result must be a composed artifact bundle with receipts.
- A human operator wants a ranked job graph before any spend occurs.

## When NOT To Use

- Do not use this skill for a one-provider task that is already clearly scoped.
- Do not use it when the buyer cannot approve spend per subtask.
- Do not use it if the outputs cannot be verified independently.
- Do not use it to hide provider identity or blur who produced what.
- Do not use it to bypass provider-specific skill requirements or approval gates.

## Inputs

- One engineering request.
- A target final artifact or release outcome.
- Provider catalog data or ACP browse results.
- Maximum spend per subtask and total budget cap.
- Timeout policy for job acceptance and delivery.
- Human approval state for the planned job graph.

## Outputs

- Request decomposition.
- Ranked provider scorecard.
- Approval-ready ACP job graph.
- Independent escrow tracking summary.
- Deliverable verification report.
- Final artifact bundle plus receipt list.

## Approval Gates

The buyer operator must approve:

1. the subtask decomposition,
2. the selected provider per subtask,
3. the spend cap for each ACP job,
4. any provider swap after ranking,
5. completion of any job whose output is still unverified,
6. the final bundle before it is published or handed off.

If any approval is missing, stop and hand control back to the operator.

## Workflow

1. Read the engineering request and identify the final expected artifact.
2. Split the request into subtasks with explicit acceptance criteria.
3. Browse ACP providers for each subtask.
4. Rank providers using capability match, evidence quality, budget fit, turnaround fit, and verification clarity.
5. Produce a shortlisted job graph and ask the buyer operator to approve it.
6. Create one ACP job per subtask after approval.
7. Fund each escrow independently and record the job IDs.
8. Subscribe to job events and wait for deliverables.
9. Verify each deliverable against its subtask contract.
10. Reject or resubmit anything that fails verification.
11. Merge accepted deliverables into the final artifact bundle.
12. Return receipts, bundle contents, and the final status.

## ACP Commands

Use the installed ACP CLI and the exact command set supported by the environment.

Typical buyer-side flow:

```bash
acp browse "<capability query>" --chain-ids 8453
acp client create-job --provider <provider> --offering-name "<offering>" --chain-id 8453 --requirements '<json>'
acp client fund --job-id <job-id> --amount <usdc> --chain-id 8453
acp job history --job-id <job-id> --chain-id 8453 --json
acp client complete --job-id <job-id> --chain-id 8453 --reason "verified and accepted"
acp client reject --job-id <job-id> --chain-id 8453 --reason "off_spec: <gap>"
```

If the agent runtime stores provider candidates in a file or fixture, it may use the local planning helper at [../../tools/orchestrate.mjs](../../tools/orchestrate.mjs) to generate the plan before any live ACP job is created.

## Verification

Each deliverable must be checked against its acceptance criteria before it is accepted into the final bundle.

Minimum checks:

- Output matches the requested subtask.
- Output is complete enough to hand to the next provider or to the maintainer.
- Output is inspectable from public evidence or reproducible local artifacts.
- Output does not hide which provider produced it.

## Failure Conditions

Stop or reject when:

- a provider misses the agreed deadline,
- the deliverable is incomplete,
- the deliverable cannot be verified,
- the cost exceeds the approved cap,
- provider discovery yields no credible specialist,
- a subtask needs human judgment rather than another provider,
- one deliverable conflicts with another accepted deliverable.

## Recovery Behavior

- If one subtask fails, reject or resubmit only that job; do not discard successful independent jobs.
- If the provider ranking was wrong, rerank using the same published scorecard and document the reason.
- If the final bundle fails validation, keep the accepted receipts and repair the composition step only.
- If the request was decomposed badly, return to the buyer and rewrite the subtask graph before funding anything else.

## Security Considerations

- Keep buyer approvals explicit and auditable.
- Never merge provider outputs without preserving provenance.
- Never fund a job that has no verification path.
- Never claim completion if the output is only a partial artifact.
- Do not publish private keys, wallet secrets, OTPs, or private prompts in the proof bundle.
