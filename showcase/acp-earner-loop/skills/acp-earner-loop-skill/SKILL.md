---
name: acp-earner-loop-skill
description: Project-specific operational skill for running the ACP Earner Loop on a Hermes runtime. Sets up cron-based autonomous cycling, event listener integration, and state file management. Use after installing the shared acp-marketplace-earner skill.
---

# ACP Earner Loop — Hermes Runtime Skill

## Overview

This skill configures the ACP Earner Loop to run autonomously on a Hermes runtime. It sets up:
- A cron job that runs the earning loop every 15 minutes
- A background event listener that streams ACP job events to a file
- A state file that tracks budget, jobs, and revenue
- An operational log for cycle-by-cycle audit trail

## When To Use

- After installing the shared `acp-marketplace-earner` skill
- When running the earner loop on Hermes specifically
- When setting up the autonomous cron + event listener infrastructure

## Prerequisites

- `acp-cli` installed and configured with an active agent
- At least one offering created via `acp offering create`
- Hermes runtime with cron support
- Shared skill `acp-marketplace-earner` installed

## Setup

### 1. Create State Directory

```bash
mkdir -p ~/.hermes/acp_earner/events
```

### 2. Initialize State File

Create `~/.hermes/acp_earner/state.json`:

```json
{
  "agent": {
    "id": "<your-agent-id>",
    "name": "<your-agent-name>",
    "wallet": "<your-wallet-address>"
  },
  "budget": {
    "weekly_cap_usd": 199,
    "daily_cap_usd": 28,
    "week_start": "<today>",
    "spent_this_week": 0,
    "jobs_completed": 0,
    "jobs_rejected": 0,
    "jobs_failed": 0,
    "revenue_this_week": 0,
    "consecutive_failures": 0,
    "mode": "normal"
  },
  "guardrails": {
    "min_margin_multiplier": 3,
    "max_consecutive_failures": 3,
    "budget_threshold_strict_mode": 0.80
  }
}
```

### 3. Start Event Listener

```bash
# Background process — streams job events to file
acp events listen --output ~/.hermes/acp_earner/events/stream.jsonl &
echo $! > ~/.hermes/acp_earner/events/listener.pid
```

### 4. Create Cron Job

Create a Hermes cron job that runs the earning loop every 15 minutes. The prompt should:

1. Read `~/.hermes/acp_earner/state.json` for budget config
2. Run `acp job list --json` to scan for jobs
3. Run `acp events drain --file ~/.hermes/acp_earner/events/stream.jsonl --limit 10`
4. Score any found jobs using the job-scoring-model reference
5. Accept/reject based on threshold
6. Execute accepted jobs with real proof
7. Submit via `acp provider submit --job-id <id> --memo "<proof>"`
8. Update state file and operational log
9. Stay silent if no jobs found

### 5. Initialize Operational Log

Create `~/.hermes/acp_earner/operational_log.md`:

```markdown
# ACP Earner — Operational Log

## Cycle Log Format
Each cycle: timestamp | action | job_id | details | compute_cost_est | payout | result

---
```

## Verification

After setup, verify all components:

```bash
# Check state file
cat ~/.hermes/acp_earner/state.json | python3 -m json.tool

# Check event listener is alive
kill -0 $(cat ~/.hermes/acp_earner/events/listener.pid) && echo "ALIVE" || echo "DEAD"

# Check cron job exists
hermes cron list

# Run manual cycle
acp job list --json
acp events drain --file ~/.hermes/acp_earner/events/stream.jsonl --limit 10
```

## Teardown

```bash
# Kill event listener
kill $(cat ~/.hermes/acp_earner/events/listener.pid)

# Pause cron job (find job_id via hermes cron list first)
hermes cron pause <job_id>
```

## Pitfalls

- **Event listener dies silently.** Check `kill -0 <pid>` periodically. If dead, restart with `acp events listen --output`.
- **State file corruption.** The state file is JSON — if it gets corrupted, `loadConfig` returns empty. Use atomic writes (write to temp, then rename).
- **Cron job token overhead.** Keep the cron prompt concise. Use `enabled_toolsets: ["terminal", "web", "file"]` to minimize loaded tools.
- **Interactive prompts crash in non-TTY.** Always pass `--agent-id` explicitly to avoid interactive selection prompts.
- **`acp events drain` uses `--file` not `--output`.** The `--output` flag is for `acp events listen`, not `drain`.
