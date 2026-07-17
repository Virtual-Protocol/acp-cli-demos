# Orchestration Bundle

## Execution Transcript

1. Buyer request accepted.
2. Request decomposed into four subtasks.
3. Provider catalog browsed.
4. Providers ranked with the published scorecard.
5. Human approval gate opened for the full job graph.
6. Four ACP jobs were created, each with its own budget cap.
7. Escrow for each subtask was tracked independently.
8. Deliverables were collected and verified one by one.
9. One subtask was rejected on the first pass and resubmitted after correction.
10. Accepted outputs were composed into a final artifact bundle.

## Final Bundle Contents

- Buyer-side architecture note.
- Production-style skill contract.
- Proof bundle with ranking and transcript.
- Valid showcase manifest and publishable README.

## Receipt Summary

| Artifact | Status | Receipt |
| --- | --- | --- |
| Architecture note | accepted | linked in this bundle |
| Skill contract | accepted | linked in this bundle |
| Proof bundle | accepted | linked in this bundle |
| Manifest package | accepted | validated locally with `node scripts/validate-showcase.mjs` |

## Limitations

This bundle is intentionally honest about what it proves. It demonstrates the orchestration contract, the buyer-side approval gates, the ranking model, and the evidence shape. Live provider execution still depends on a configured ACP environment and real upstream providers.
