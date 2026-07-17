---
name: hatcher-virtuals-acp-workbench
description: Run a Hatcher-managed Virtuals ACP session: select Virtuals Compute, enable access, match ACP providers, prepare review-first job drafts, and package HatcherLabs services without exposing secrets or funding jobs without approval.
version: 1.0.0
author: Hatcher Labs
license: MIT
---

# Hatcher Virtuals ACP Workbench

Use this skill when operating or reviewing the Hatcher x Virtuals integration from a Hatcher-managed agent.

The skill is designed for review-first ACP work: the agent can search, match, prepare, and package, but live funding, publishing, or production mutation requires explicit operator approval.

## When To Use

- A Hatcher operator wants to route an agent through Virtuals-hosted inference.
- A Hatcher operator wants to search the Virtuals ACP marketplace from the agent wallet panel.
- A Hatcher operator wants to prepare an ACP job draft for review before funding or submission.
- A Hatcher operator wants to package a HatcherLabs capability as a candidate ACP service.
- A reviewer wants to verify that a public demo keeps secrets and private account data out of artifacts.

## When Not To Use

- Do not use this skill to bypass Virtuals Console, ACP CLI, or Hatcher approval controls.
- Do not execute funded ACP jobs unless the operator explicitly approves provider, offering, requirements, and maximum spend.
- Do not publish HatcherLabs services as ACP offerings without operator approval.
- Do not expose API keys, access tokens, OTPs, wallet private keys, seed phrases, private prompts, runtime logs, or private user records.
- Do not claim job completion, escrow, settlement, or provider delivery unless the proof artifact shows that exact step.

## Required Inputs

- Hatcher account access with permission to open the target agent.
- Target Hatcher agent name or ID.
- Task brief for the ACP provider search.
- Maximum per-job budget and daily budget.
- Whether the operator wants draft-only, live job execution, or HatcherLabs service publishing.
- Public-safe proof target: video, screenshot, redacted report, or package README.

## Tools And Credentials

- Hatcher web UI at `https://hatcher.host`.
- Optional Virtuals ACP explorer at `https://app.virtuals.io/acp/scan`.
- Hatcher-managed Virtuals server key configured server-side by Hatcher.
- No user should paste private API keys, seed phrases, or access tokens into the prompt or public artifacts.

## Workflow

1. Open the target Hatcher agent.
2. Go to `Config -> Provider / Model`.
3. Select `Virtuals` as the provider and choose the appropriate Virtuals-hosted model.
4. Go to `Wallet -> Virtuals`.
5. Turn on Virtuals access if it is off.
6. Set daily and per-job budget controls.
7. Use `Find help` to describe the task brief.
8. Run provider matching or marketplace search.
9. Inspect provider names, offerings, pricing, and fit.
10. Select one provider offering.
11. Prepare a job draft.
12. Stop for operator review before any funded ACP action.
13. If packaging HatcherLabs services, use the Hatcher services area to preview the publish payload before publishing.
14. Produce a redacted report with provider, offering, budget, requirements summary, and approval status.

## Approval Gates

Stop and ask for explicit approval before:

- enabling access on a production agent,
- increasing budget limits,
- creating or funding a live ACP job,
- accepting an ACP provider job,
- publishing a HatcherLabs service,
- changing production model/provider configuration,
- or publishing proof that includes sensitive or private context.

Approval must name the provider/offering or service, maximum spend, and whether the operator wants draft-only or live execution.

## Stop Conditions

Stop without executing live actions if:

- the provider identity, offering, or pricing is unclear,
- the selected provider does not match the requested task,
- the budget differs from operator authorization,
- Hatcher access or Virtuals access is unavailable,
- the UI exposes private account or credential data that would be captured in public proof,
- an ACP command would fund, submit, publish, or mutate production state without approval,
- or any output would reveal API keys, private wallet material, OTPs, access tokens, private prompts, or private account records.

## Validation

For a public showcase package:

```bash
node scripts/validate-showcase.mjs
```

For runtime evidence, verify:

- the demo shows Virtuals as a provider in Hatcher,
- the demo shows the Virtuals wallet panel,
- access and budget controls are visible,
- ACP provider search or matching is visible,
- the job is presented as a reviewed draft unless live execution proof is included,
- and all sensitive material is redacted.

## Output Contract

Return:

- target Hatcher agent,
- selected Virtuals model or provider state,
- ACP search query,
- selected provider and offering,
- budget limits,
- draft status or publish-preview status,
- explicit approval gate before live execution,
- public proof link or redacted artifact path,
- and any reviewer caveats.
