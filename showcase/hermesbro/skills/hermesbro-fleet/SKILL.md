---
name: hermesbro-fleet
description: Deploy and operate a multi-agent Hermes fleet with ACP commerce, Telegram gateways, and shared knowledge graph.
---

# HermesBro Fleet Skill

Reusable skill for deploying and operating a multi-agent Hermes Agent fleet. Covers profile management, ACP provider setup, cross-bot knowledge sharing via Neo4j, cron-based autonomous cycling, and Telegram gateway routing.

## Prerequisites

- Hermes Agent installed (`pip install hermes-agent`)
- Node.js 20.x (for Neo4j driver and ACP CLI)
- Neo4j instance (local or remote)
- Telegram bot token
- ACP CLI (`acp`) configured
- DeepSeek API key (or compatible provider)

## Fleet Structure

```
~/.hermes/profiles/
├── gribbito/   # Personal assistant + fleet coordinator
├── cuoco/      # Kitchen & wine-bar assistant
├── frank/      # Code review & knowledge curator
├── designbro/  # Graphic design
├── sage/       # Research & intelligence
└── ...
```

Each profile has:
- `SOUL.md` — Agent identity and personality
- `GOAL.md` — Mission, channels, inbound/outbound, goals
- `config.yaml` — Model, provider, gateway settings

## Setup Steps

### 1. Create a new agent profile

```bash
hermes profile create <agent-name> --from-template <template>
```

### 2. Configure the agent's provider and model

```yaml
# ~/.hermes/profiles/<agent>/config.yaml
provider: deepseek
model: deepseek-v4-flash
```

Use `deepseek-v4-pro` for orchestrator/critical agents, `deepseek-v4-flash` for workers.

### 3. Enable Telegram gateway

```yaml
# config.yaml
gateway:
  platform: telegram
  token: <bot-token>
  enabled: true
```

### 4. Register as ACP provider

```bash
acp agent create \
  --name "<agent-name>" \
  --identity "$(acp identity create --label <agent-name>)"
  
acp offering create \
  --agent <agent-id> \
  --name "<offering-name>" \
  --price <price-in-usdc> \
  --category agent-services
```

### 5. Set up shared knowledge via Neo4j

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "<password>"))

def write_fact(fact: str, section: str, source: str):
    with driver.session() as session:
        session.run(
            "MERGE (f:Fact {content: $fact}) "
            "SET f.section = $section, f.source = $source, f.updated = datetime()",
            fact=fact, section=section, source=source
        )
```

### 6. Set up autonomous cycling (optional)

```bash
hermes cron create \
  --profile <agent> \
  --schedule "every 4h" \
  --prompt "Run your autonomous cycle: check for new ACP jobs, process any pending tasks, report status."
```

## Fleet Management Tips

- **Cost monitoring**: Use a dedicated agent (e.g. GribbitO) to track per-agent token usage
- **Health checks**: Cron job pinging each profile every 6h
- **Shared memory**: Log fleet-wide facts using the shared-knowledge scripts (`fact-log.py`, `decision-log.py`, `preference-log.py`)
- **Security**: Deploy `io_controls.py` in the shared security layer to filter injection across all profiles

## Pitfalls

- **Token costs**: Multi-agent fleets burn tokens fast. Use Flash models for workers, set usage caps
- **Gateway conflicts**: Two Telegram bots cannot share the same token. Each profile needs its own bot
- **Neo4j connection**: Local Neo4j can be memory-heavy (4 GB+). Use remote or disable if tight on RAM
- **ACP registration**: Requires an on-chain transaction on Base — budget for gas fees (~$0.01 per tx)

## Related

- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs)
- [ACP CLI](https://github.com/Virtual-Protocol/acp-cli)
- [Neo4j](https://neo4j.com/docs/)
