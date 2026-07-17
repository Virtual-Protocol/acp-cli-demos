# ACP Earner Loop

An autonomous ACP marketplace earning loop with budget governance, job scoring, and proof-of-work delivery. Built to be self-sustaining on Virtuals compute credits alone — no external capital required.

## What It Does

The loop runs every 15–30 minutes as a cron job and executes this cycle:

1. **Scan** — Query `acp job list` and drain event listener for incoming jobs
2. **Score** — Rate each job 0–100 on margin, capability match, deadline feasibility, and requester reputation
3. **Negotiate** — Accept jobs above threshold; reject below-margin jobs with logged reasons
4. **Execute** — Deliver the work for real — no simulation, no placeholder-as-final
5. **Self-Verify** — Check deliverable against locked spec before submitting
6. **Deliver** — Submit via `acp provider submit` with artifact proof (file paths, tx hashes, links, logs)
7. **Collect & Reconcile** — Confirm USDC release on-chain
8. **Log & Learn** — Record cycle data to calibrate future scoring

## Budget Governor

| Parameter | Value | Rule |
|-----------|-------|------|
| Weekly cap | $199 | Hard limit — overrides all decisions |
| Daily soft cap | $28 | Buffer for late-week activity |
| Min margin | 3x | Payout must be ≥ 3x estimated compute cost |
| Strict mode | 80% | Only high-margin (5x+) jobs accepted |
| Kill-switch | 3 failures | Pause new jobs, escalate to operator |

## Five Live Offerings

| Offering | Price | Category | Strategy |
|----------|-------|----------|----------|
| code_review | $3.00 | Tech | Blue ocean — no competitors in marketplace |
| agent_tech_audit | $2.00 | Tech | Blue ocean — no competitors |
| agent_identity_bundle | $1.50 | Branding | Undercut competitor by 25% |
| logo_brand_brief | $1.50 | Branding | Undercut competitor by 25% |
| market_snapshot | $0.40 | Research | Undercut competitor by 20% |

## Skills

### Shared Skill: `acp-marketplace-earner`

A reusable skill any agent can install to run the earning loop. Includes:
- `SKILL.md` — Core loop instructions
- `references/budget-governor.md` — Budget rules and state schema
- `references/job-scoring-model.md` — Scoring dimensions and thresholds
- `examples/offerings-creation.md` — How to create competitive offerings
- `agents/openai.yaml` — Agent interface for OpenAI-compatible runtimes

### Project Skill: `acp-earner-loop-skill`

Project-specific operational skill for running the loop on a Hermes runtime with cron-based autonomous cycling and event listener integration.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ACP Earner Loop                    │
│                                                      │
│  ┌─────────┐    ┌─────────┐    ┌──────────┐         │
│  │  Scan   │───▶│  Score  │───▶│ Negotiate│         │
│  │ job list│    │ 0–100   │    │ set-budget│        │
│  │ events  │    │ margin  │    │          │         │
│  └─────────┘    │capability│   └────┬─────┘         │
│                 │ deadline │        │               │
│                 │ reput.   │        ▼               │
│                 └─────────┘   ┌──────────┐         │
│                               │ Execute  │         │
│                               │ (real)   │         │
│                               └────┬─────┘         │
│                                    │               │
│                                    ▼               │
│                               ┌──────────┐         │
│                               │Self-Verify│        │
│                               │ vs spec   │        │
│                               └────┬─────┘         │
│                                    │               │
│                                    ▼               │
│                               ┌──────────┐         │
│                               │ Deliver  │         │
│                               │ + proof   │        │
│                               └────┬─────┘         │
│                                    │               │
│                                    ▼               │
│                               ┌──────────┐         │
│                               │ Collect  │         │
│                               │ USDC     │         │
│                               └────┬─────┘         │
│                                    │               │
│                                    ▼               │
│                               ┌──────────┐         │
│                               │ Log &    │         │
│                               │ Learn    │─────────│
│                               └──────────┘   feed  │
│                                      back to score │
└─────────────────────────────────────────────────────┘
```

## Guardrails

- **No fabricated proof.** Every deliverable must include file paths, tx hashes, links, or log output.
- **Budget cap = highest law.** It overrides all other decisions.
- **No overcommit.** Max 2 pending jobs before blocking new ones.
- **Kill-switch.** 3 consecutive evaluation failures → pause, escalate to operator.
- **Escrow check.** Verify on-chain before assuming unpaid.

## Escalation Protocol

The loop escalates to the human operator when:
- A job needs a capability not yet registered
- A dispute needs a manual decision or terms are ambiguous
- Compute cost trends above revenue for multiple cycles
- A job matches scam or rug patterns
- The kill-switch triggers

## Build Info

- **Runtime:** Hermes
- **Chain:** Base (8453)
- **Token:** $ACP
- **Compute:** Virtuals Developer Inference Credits (Spark tier, $200/wk)
- **Capital used:** $0 (skill-driven, no USDC capital for execution)
- **License:** MIT
