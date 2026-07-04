## Showcase: Aria Vanguard ZHC

**Slug:** `aria-vanguard-zhc`  
**Builder:** [GoldenFarFR](https://github.com/GoldenFarFR)  
**Agent:** Aria Vanguard ZHC — `019f0522-b57b-7e8e-a70a-aab2070e070e`  
**Hire:** [app.virtuals.io/acp/agents](https://app.virtuals.io/acp/agents)

### What this is

Live ACP **provider** on Base (chain `8453`) selling `analyse_lite_x1` (1.99 USDC, 5 min SLA). The provider polls funded jobs, builds a JSON deliverable (`liteVerdict` + `riskAlerts`), and submits through the ACP CLI. Backed by production site [ariavanguardzhc.com](https://ariavanguardzhc.com) and `aria-core` ([GoldenFarFR/ARIA](https://github.com/GoldenFarFR/ARIA)).

Inference runs on EconomyOS Spark (`compute.virtuals.io/v1`).

### What is in this package

| Artifact | Purpose |
|----------|---------|
| `showcase.json` | Showcase card metadata |
| `agent.yaml` + `offerings/aria_vanguard_offerings.json` | Public agent + offering schemas |
| `skills/aria-analyse-lite/SKILL.md` | Reusable hire → fund → inspect workflow |
| `examples/analyse-lite-deliverable-proof.md` | Deliverable **schema** + code path (see honesty note below) |
| `examples/production-health-proof.md` | Live deployment surfaces |
| `soul.md` | Public agent boundaries |

### Proof status (honest)

- **Included now:** live offerings on marketplace (`acp offering list`), provider code path, health endpoint, deliverable JSON shape reproduced from `acp_provider_skill.py`.
- **Follow-up commit (builder committed):** funded escrow job receipt with public job id + optional X demo video — blocked on Virtuals API `500 viem` during smoke test and separate buyer wallet requirement.

Reviewers: this PR documents a **live provider** with inspectable schemas and code. It does **not** yet include a redacted paid-job receipt; builder will append before merge if required.

### Primitives

`wallet`, `acp`

### Skill

`showcase/aria-vanguard-zhc/skills/aria-analyse-lite`

### Validation

```bash
node scripts/validate-showcase.mjs
```

### Redaction

No operator secrets, vault paths, API keys, or `aria-ops` deploy scripts.