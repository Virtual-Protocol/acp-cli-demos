# HermesBro Fleet

**Live multi-agent fleet on Hermes Agent — 16 agents, Telegram frontends, shared knowledge graph, all self-hosted on a €50/mo VPS.**

## What It Is

HermesBro is a production multi-agent system where 16 specialised AI agents operate around the clock, each with a distinct role and identity. They share a Neo4j knowledge graph, communicate via Telegram, and coordinate through a central orchestration layer — all running on a single €19/mo VPS with DeepSeek as the backbone LLM.

## Agents

| Agent | Role | ACP Registration |
|-------|------|-----------------|
| **GribbitO** | Personal assistant, fleet coordinator | Planned |
| **Cuoco** | Kitchen & wine-bar helper, Todoist manager | Planned |
| **Frank** | Code review & shared knowledge curator | — |
| **DesignBro** | Graphic design, brand, visuals | — |
| **Sage** | Market intelligence & research | — |
| *(11 more)* | Various specialised roles | — |

## Architecture

```
User (Telegram)
    │
    ▼
┌─────────────────────────────────────┐
│   Hermes Gateway (gribbito profile) │
│   - Message routing                 │
│   - Cron scheduler                  │
└─────────────────────────────────────┘
    │                  │
    ▼                  ▼
┌──────────┐    ┌──────────┐
│ GribbitO │    │  Cuoco   │  ... 16 agents
│ (PA)     │    │ (kitchen)│
└──────────┘    └──────────┘
    │                  │
    └──────┬───────────┘
           ▼
┌──────────────────┐
│  Neo4j Knowledge │
│  Graph (fleet    │
│  shared memory)  │
└──────────────────┘
```

## Key Features

- **Telegram-first** — Every agent is reachable through Telegram DM or group chat
- **Shared knowledge** — Neo4j graph stores facts, decisions, and preferences across all agents
- **Autonomous or interactive** — Cron-driven loops for background tasks, Telegram for on-demand interaction
- **Cost-efficient** — Entire fleet operates on a €50/mo budget (VPS €19 + LLM tokens ~€30)
- **Open source** — Hermes Agent is MIT; HermesBro profiles are publicly forkable
- **ACP-ready** — Agents are preparing to register on the EconomyOS ACP marketplace

## Proof Included

This package contains:

- [Fleet roster](examples/fleet-roster.md) — All 16 agent manifest cards
- [Telegram conversation log](examples/telegram-conversation-log.md) — Real multi-agent interactions
- [Cost audit ledger](examples/cost-audit-ledger.md) — Month-by-month spending breakdown
- [HermesBro fleet skill](skills/hermesbro-fleet/SKILL.md) — Reusable deployment skill

## Links

- Site: [hermesbro.cloud](https://hermesbro.cloud)
- Hermes Agent: [github.com/nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent)
- ACP CLI: [github.com/Virtual-Protocol/acp-cli](https://github.com/Virtual-Protocol/acp-cli)
