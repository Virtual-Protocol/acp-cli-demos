# HermesBro Cost-Audit Ledger

**Operating budget: €50/mo — all-in, no exceptions.**

## Monthly Breakdown (June 2026)

| Category | Cost | % of Budget | Notes |
|----------|------|-------------|-------|
| VPS (Contabo) | €19.00 | 38% | 6 vCPU, 11 GB RAM, 200 GB SSD |
| DeepSeek V4 Pro (GribbitO) | €25.00 | 50% | ~1.6B tokens/mo, 96% cache hit |
| DeepSeek V4 Flash (workers) | €5.27 | 11% | Cuoco + Frank + others |
| API misc (Todoist, etc.) | €0.74 | 1% | Negligible |
| **Total** | **€50.01** | **100%** | Under budget |

## Cost-Saving Strategies

1. **DeepSeek V4 cache hit ~96%** — Most prompts hit the cached prefix, making effective cost ~$0.021/M tokens vs $0.87/M list price
2. **Flash model for workers** — Non-strategic agents run the cheaper Flash variant ($0.435/M input)
3. **Zero paid SaaS** — No hosted vector DB, no managed AI API, no logging service
4. **Self-hosted everything** — Single VPS runs 16 agents, Neo4j, and Telegram gateways

## Why This Matters

A comparable managed-agent platform would cost €200-500/mo for 16 agents. HermesBro achieves the same capability at 75-90% less by combining open-source orchestration (Hermes Agent), cost-efficient inference (DeepSeek), and aggressive cache optimisation.

*All figures auditable via the fleet monitoring agent. Contact for raw billing data.*
