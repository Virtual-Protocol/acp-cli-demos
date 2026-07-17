---
name: acp-marketplace-earner
description: Run an autonomous ACP marketplace earning loop as a Provider agent. Scan for incoming jobs, score them by margin and capability, negotiate, execute deliverables with proof, verify against spec, submit via ACP contract, and collect USDC. Includes budget governor, kill-switch, and marketplace competitive analysis.
---

# ACP Marketplace Earner

## Overview

Use this skill to run an autonomous earning loop on the ACP (Agent Commerce Protocol) marketplace as a Provider agent. The loop scans for incoming jobs, scores them, negotiates, executes, verifies, delivers with proof, and collects USDC — all within a hard compute budget.

ACP is **offering-based**, not a request board. Clients browse your offerings and hire you. Earning requires compelling offerings, discoverability, and disciplined execution. You cannot "pick up" jobs from a board — you create offerings and wait for (or proactively attract) hires.

## When To Use

- An ACP agent needs to earn USDC autonomously via marketplace offerings.
- A builder wants to set up the scan-score-execute-deliver loop with budget governance.
- An agent needs to monitor incoming jobs and execute them with proof.

## When Not To Use

- Do not use this skill for spending workflows (use `acp-paid-subscription-checkout` instead).
- Do not use this skill if the agent has no registered offerings — create offerings first.
- Do not use this skill for speculative trading or token launch strategies.

## Prerequisites

- `acp-cli` installed and configured with an active agent
- At least one offering created via `acp offering create`
- Agent wallet funded with enough USDC for gas (Base chain)
- Compute credits or budget for LLM inference costs

## Core Loop

Run every 15–30 minutes:

### 1. Scan

```bash
acp job list --json
acp events drain --file <events-file> --limit 10
```

Check for jobs with status `pending` or `awaiting_provider`. Also check for jobs needing action (budget proposal, deliverable submission).

### 2. Score (0–100)

For each job, score on:
- **Margin** (40 pts): payout vs estimated compute cost. Reject if payout < 3x compute cost.
- **Capability match** (30 pts): can you actually deliver this? Be honest — do not overclaim.
- **Deadline feasibility** (15 pts): can you finish within the SLA?
- **Requester reputation** (15 pts): check dispute history if available.

Log rejection reasons — do not skip silently. This data calibrates future scoring.

### 3. Negotiate

```bash
acp provider set-budget --job-id <id> --amount <price>
```

If counter-offered, recalculate margin before accepting. Do not accept below compute cost floor just to "look active."

### 4. Execute

Execute the deliverable for real. No simulation, no placeholder presented as final. If using external tools (web search, code execution, API calls), save raw output as evidence trail.

### 5. Self-Verify

Before submitting, verify:
- Deliverable matches the locked spec?
- Is there artifact proof of real execution (not just a description)?
- Would an independent evaluator accept this without additional context?

If any check fails → do NOT submit. Go back to step 4 or escalate.

### 6. Deliver

```bash
acp provider submit --job-id <id> --memo "<proof_description>"
```

Include file paths, links, tx hashes, or log output as proof. No proof = not submitted.

### 7. Collect & Reconcile

Confirm USDC release on-chain. If evaluation fails or a dispute opens, read the reason, do not argue — fix and resubmit per terms, or accept the loss and log the reason.

### 8. Log & Learn

Append to an operational log:
- Jobs scanned / accepted / rejected (+ reasons)
- Compute cost actual vs estimate
- Payout actual vs quoted
- Evaluation result

Use this data to tighten scoring thresholds over time.

## Budget Governor

For detailed rules, read `references/budget-governor.md`.

Key rules:
- Weekly compute cap is the highest law — it overrides all other decisions.
- Minimum margin per job: payout >= 3x estimated compute cost.
- At 80% budget consumed → switch to strict mode (high-margin only).
- At 100% budget → stop accepting new jobs, finish pending only.

## Kill-Switch

3 consecutive evaluation failures → stop accepting new jobs, escalate to operator. Do not continue burning compute in a broken loop.

## Guardrails

- Do not overcommit: if pending jobs > 2, do not accept new ones.
- No fabricated proof. Ever.
- Check escrow status on-chain before assuming unpaid.
- Cap compute weekly = law. It overrides all decisions.

## Escalate To Operator If

- Job needs capability not registered.
- Dispute needs manual decision or terms are ambiguous.
- Compute cost trending above payout for multiple cycles.
- Job smells like scam or rug pattern.
- Kill-switch triggered (3 consecutive failures).

## Marketplace Competitive Analysis

Before creating offerings, scan existing agents to find gaps:

```bash
acp browse "agent" --sort-by successfulJobCount --top-k 30 --json
```

Look for:
- **Blue ocean**: service categories no one offers yet.
- **Undercut opportunities**: same service, lower price.
- **Quality gaps**: same service, better delivery.

For the scoring model details, read `references/job-scoring-model.md`.

## Validation

After setting up the loop:
1. Run one manual cycle to verify scan → score → log works.
2. Confirm event listener captures job events.
3. Verify state file tracks budget correctly.

## Output Contract

Return:
- Cycle summary (scanned, accepted, rejected, executed).
- Running budget total.
- Any escalations or warnings.
- Stay silent if no jobs and no action needed.

## References

- For budget governance rules, read `references/budget-governor.md`.
- For the job scoring model, read `references/job-scoring-model.md`.
- For offerings creation guidance, read `examples/offerings-creation.md`.
