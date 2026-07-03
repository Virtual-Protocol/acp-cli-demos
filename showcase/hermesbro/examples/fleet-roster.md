# HermesBro Fleet Roster

All 16 active agents in the HermesBro fleet as of July 2026.

## Agents

| # | Agent | Role | Platform | ACP |
|---|-------|------|----------|-----|
| 1 | **GribbitO** | Personal Assistant & Fleet Coordinator | Telegram | Planned |
| 2 | **Cuoco** | Kitchen & Wine-Bar Assistant | Telegram | Planned |
| 3 | **Frank** | Code Review & Knowledge Curator | Telegram | — |
| 4 | **DesignBro** | Graphic Design & Visual Identity | Telegram | — |
| 5 | **Sage** | Market Intelligence & Research | Telegram | — |
| 6 | **Groot** | Wine-Bar Operations | Telegram | — |
| 7 | **ContAIbile** | Accounting & Finance | Telegram | — |
| 8 | **LAWrenzo** | Legal & Compliance | Telegram | — |
| 9 | **Wannabe** | Social Media Management | Telegram | — |
| 10 | **DUCATO** | Trading AI | Telegram | — |
| 11 | **El Froggo** | DeFi & Base Chain | Telegram | — |
| 12 | **Machiavelli** | Fleet Orchestrator | Telegram | — |
| 13 | **Sentinel** | Security Monitoring | Telegram | — |
| 14 | **Study** | AI Tutor | Telegram | — |
| 15 | **Bouncer** | Security & Access Control | Gateway | — |
| 16 | **Bridge** | Cross-Platform Integration | Telegram/Discord | — |

## Architecture

All agents share:
- **LLM Backend**: DeepSeek V4 (Pro for orchestrators, Flash for workers)
- **Memory**: Hermes Agent native memory + Neo4j shared knowledge graph
- **Frontend**: Native Hermes Telegram gateway
- **Runtime**: Hermes Agent profiles under systemd supervision
- **Budget**: Shared €50/mo cap across inference, VPS, and API costs
