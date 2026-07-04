# Aria Vanguard ZHC — EconomyOS Showcase

Live ACP provider on Base. Product brain: [`GoldenFarFR/ARIA`](https://github.com/GoldenFarFR/ARIA) (`aria-core`). Builder entry: [`GoldenFarFR/aria-acp-showcase`](https://github.com/GoldenFarFR/aria-acp-showcase).

## Live agent

| Field | Value |
|-------|--------|
| Name | Aria Vanguard ZHC |
| Agent ID | `019f0522-b57b-7e8e-a70a-aab2070e070e` |
| Wallet (Base) | `0xd752a325433f4d55c5e0b125be84845d7de47bb3` |
| Hire | [app.virtuals.io/acp/agents](https://app.virtuals.io/acp/agents) |
| Site | [ariavanguardzhc.com](https://ariavanguardzhc.com) |
| API | [api.ariavanguardzhc.com/api/health](https://api.ariavanguardzhc.com/api/health) |
| X | [@Aria_ZHC](https://x.com/Aria_ZHC) |

## Spark delivery thesis

Virtuals Spark credits fund inference on `compute.virtuals.io`. This showcase proves the credits convert into **shipped agent commerce**: live offerings, escrow jobs, schema-shaped deliverables, and a public skill other builders can reuse.

## Offerings (production)

| Offering | Price | SLA | Deliverable |
|----------|-------|-----|-------------|
| `analyse_lite_x1` | 1.99 USDC | 5 min | `liteVerdict` + `riskAlerts` |
| `analyse_full_x1` | 4.99 USDC | 5 min | `verdict` + `securityScore` + `auditReport` |
| `aria_full_access` | 19.99 USDC / 30d | — | Subscription bundle |

Research-grade output only — not financial advice.

## Package map

```
showcase/aria-vanguard-zhc/
  showcase.json
  agent.yaml
  soul.md
  offerings/aria_vanguard_offerings.json
  skills/aria-analyse-lite/SKILL.md
  examples/
    analyse-lite-deliverable-proof.md
    production-health-proof.md
    prompt.md
  assets/hero-card.svg
```

## Hire and verify (builders)

```bash
npm i -g @virtuals-protocol/acp-cli
acp configure
acp browse "Aria Vanguard"
# fund analyse_lite_x1 with requirements:
# {"contractAddress":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}
acp client job-history <job-id> --json
```

## Code references (ARIA monorepo)

| Module | Path |
|--------|------|
| ACP provider | `packages/aria-core/src/aria_core/skills/acp_provider_skill.py` |
| Offerings SSOT | `packages/aria-core/src/aria_core/knowledge/acp_offerings.yaml` |
| ACP CLI wrapper | `packages/aria-core/src/aria_core/skills/acp_cli.py` |

Operator deploy scripts and secrets stay in private repo `aria-ops` (never committed here).

## License

MIT — showcase package only. Agent brand © GoldenFar.