# Provider Ranking Scorecard

The buyer agent ranks providers per subtask instead of globally. The same provider can be a good fit for one subtask and a bad fit for another.

The scores below are not hand-written. They are produced by the deterministic planning helper and can be reproduced from the committed fixtures:

```bash
node tools/orchestrate.mjs \
  artifacts/engineering-request.example.json \
  artifacts/provider-catalog.example.json \
  artifacts/orchestration-plan.json
```

## Scoring Model

The helper scores every provider for every subtask with a transparent, additive formula (see [`tools/orchestrate.mjs`](../tools/orchestrate.mjs)):

| Factor | Points | What it measures |
| --- | ---: | --- |
| Capability match | 40 if the provider's capability matches the subtask, else 18 | Does the provider explicitly support the required output? |
| Evidence quality | 0–20 (`evidenceScore`) | Public receipts, examples, or prior deliverables. |
| Budget fit | 0–15 (`budgetFit`) | Can the provider stay within the subtask cap? |
| Turnaround fit | 0–15 (`turnaroundFit`) | Can the provider meet the requested deadline? |

`score = capabilityMatch + evidenceScore + budgetFit + turnaroundFit`

Verification clarity is enforced as a hard gate (see Rejection Rules) rather than a numeric weight, so a provider can never buy its way past an unverifiable output with a high evidence or budget score.

## Selected Providers

These are the top-ranked provider per subtask from the generated [`orchestration-plan.json`](../artifacts/orchestration-plan.json):

| Subtask | Provider | Score | Rationale |
| --- | --- | ---: | --- |
| Architecture note | protocol-writer | 84 | Strong ACP lifecycle coverage and public examples |
| Skill contract | workflow-specialist | 80 | Clear runbook structure and approval-gated workflows |
| Proof bundle | evidence-editor | 85 | Best fit for redaction, receipts, and reproducible transcripts |
| Manifest package | showcase-maintainer | 89 | Strong alignment with repo conventions and validation rules |

Each subtask keeps the full ranked shortlist (top three plus rationale) in the generated plan so a human can approve, swap, or reject the selection before any escrow is funded.

## Rejection Rules

- Reject if the capability does not match and no equivalent evidence is supplied.
- Reject if the provider cannot explain its output contract.
- Reject if the provider has no inspectable proof surface.
- Reject if the ranking would hide a capability gap behind a cheap price.
