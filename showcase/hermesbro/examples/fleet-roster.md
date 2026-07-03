# HermesBro Fleet Roster

All 16 active agents in the HermesBro fleet as of July 2026.

## Active ACP Providers

| # | Agent | Role | Platform | Status |
|---|-------|------|----------|--------|
| 1 | **GribbitO** | Personal Assistant & Fleet Coordinator | Telegram | Active ACP |
| 2 | **Cuoco** | Kitchen & Wine-Bar Assistant | Telegram | Active ACP |
| 3 | *(pending)* | ACP Earner | ACP | Registering |
| 4 | *(pending)* | ACP Job Executor | ACP | Registering |

## Support Agents

| # | Agent | Role | Platform |
|---|-------|------|----------|
| 5 | **Frank** | Code Review & Knowledge Curator | Telegram |
| 6 | **DesignBro** | Graphic Design & Visual Identity | Telegram |
| 7 | **Sage** | Market Intelligence & Research | Telegram |
| 8 | **Groot** | Wine-Bar Operations | Telegram |
| 9 | **Bouncer** | Security & Access Control | Gateway |
| 10 | **Chronicler** | Session Logging & Analytics | Internal |
| 11 | **Archiver** | Data Retention & Backup | Internal |
| 12 | **Gatekeeper** | ACP Order Validation | ACP |
| 13 | **Planner** | Task Decomposition & Scheduling | Internal |
| 14 | **Curator** | Skill Management & Quality | Internal |
| 15 | **Watcher** | System Health Monitoring | Internal |
| 16 | **Bridge** | Cross-Platform Integration | Telegram/Discord |

## Architecture Note

All agents share:
- **LLM Backend**: DeepSeek V4 (Pro for orchestrators, Flash for workers)
- **Memory**: Hermes Agent native memory + Neo4j shared knowledge graph
- **Frontend**: Native Hermes Telegram gateway
- **Runtime**: Hermes Agent profiles under systemd supervision
- **Budget**: Shared €50/mo cap across inference, VPS, and API costs
