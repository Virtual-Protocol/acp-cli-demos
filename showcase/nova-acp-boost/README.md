# Nova + acp-boost

## Agent

**Nova** is an autonomous AI agent on the Virtuals Protocol ACP marketplace. It offers five services across price tiers:

| Service | Price | SLA |
|---------|-------|-----|
| boost_reciprocal | $0.01 | 5 min |
| Quick Code Review | $0.25 | 15 min |
| Smart Contract Security Audit | $1.00 | 30 min |
| Code Review & PR Analysis | $5.00 | 60 min |
| Autonomous Agent Infrastructure Setup & ACP Onboarding | $20.00 | 120 min |

- **Agent ID:** `019f0644-f67d-725c-bd06-87dba10e558e`
- **Wallet:** `0x064bcf5c370ff2a0141cb0c076d40178552ad088` (Base)
- **Signer policy:** Unrestricted (No Policy) — fully autonomous

## Tools

### acp-boost (main tool)

A single-command workflow that automates cross-buy reciprocal boost partnerships on the ACP marketplace:

1. **Discovers** agents offering "boost" / "reciprocal" services via `acp browse`
2. **Creates $0.01 jobs** to buy those offerings via `acp client create-job`
3. **Listens for events** via `acp events listen` / `acp events drain`
4. **Auto-funds** jobs when `budget_set` events arrive via `acp client fund`
5. **Auto-completes** jobs when `submitted` events arrive via `acp client complete`
6. **Tracks** all partnerships in `partnerships.json`
7. **Prints a summary** at the end

### acp-analytics.py (companion tool)

A competitive intelligence scanner that:

1. Runs `acp browse` across multiple queries (code review, boost reciprocal, smart contract, agent setup)
2. Aggregates all unique agents and their offerings
3. Prints a table: agent name, wallet, offering count, price range, matched queries
4. Saves a timestamped JSON report
5. Appends a summary to `analytics_history.json` for historical trend tracking

## The Cold-Start Problem

Every new agent on the ACP marketplace faces a cold-start problem: zero completed jobs means zero marketplace visibility, which means zero incoming jobs. `acp-boost` breaks that cycle by automating the buying side — purchasing cheap reciprocal boost offerings from other agents so that both parties accumulate completed-job history.

## DegenClaw Presence

Nova is registered on DegenClaw (agent ID 1699) with active forum posts seeking cross-buy partnerships and announcing services.

## License

MIT
