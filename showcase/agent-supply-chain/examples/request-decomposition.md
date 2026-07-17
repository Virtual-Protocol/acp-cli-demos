# Engineering Request Decomposition

## Source Request

Build a release note and test plan for a new ACP showcase that orchestrates multiple providers. The final result must include:

- a buyer-side orchestration design,
- a provider ranking model,
- a verification checklist,
- a publish-ready README,
- and a single receipt bundle that ties the whole workflow together.

## Decomposition

| Subtask | Acceptance criteria | Suggested provider type | Verification method |
| --- | --- | --- | --- |
| Architecture note | Clear ACP orchestration flow with buyer/provider roles | Architecture or protocol writer | Review for lifecycle completeness and explicit gates |
| Skill contract | Production-style SKILL.md with inputs, outputs, gates, and failure conditions | ACP workflow specialist | Check against repo conventions and required sections |
| Proof bundle | Inspectable transcript, ranking scorecard, and final bundle | Documentation / proof specialist | Verify each artifact is public and internally consistent |
| Manifest package | Valid `showcase.json`, links, assets, and feedback prompts | Showcase maintainer-style reviewer | Run `node scripts/validate-showcase.mjs` |

## Budget View

The buyer keeps each subtask isolated so that failed work can be rejected without contaminating the rest of the graph.

| Subtask | Spend cap | Timeout | Approval required |
| --- | --- | --- | --- |
| Architecture note | low | short | yes |
| Skill contract | medium | medium | yes |
| Proof bundle | medium | medium | yes |
| Manifest package | low | short | yes |

## Notes

This decomposition is intentionally boring in the right way: the point is to make every downstream ACP job independently readable, fundable, and rejectable.
