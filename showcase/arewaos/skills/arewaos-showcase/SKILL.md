---
name: arewaos-showcase
description: Package and review an ArewaOS-style autonomous agent showcase with isolated manifest, offerings, proof receipts, and public/redacted soul context.
version: 1.0.0
author: ArewaOS
license: MIT
---

# ArewaOS Showcase Skill

Use this skill when packaging, reviewing, or adapting an ArewaOS-style agent showcase for EconomyOS or ACP demo repositories.

## When To Use

- A builder needs an agent story converted into a clean `showcase/<slug>/` package.
- A reviewer needs to verify that public proof, offerings, manifests, and agent context are isolated from the repo root.
- An agent needs a reusable workflow for turning runtime evidence into a card-ready showcase entry.

## When Not To Use

- Do not use this skill for private key handling, payment-card handling, OTP extraction, or unredacted account evidence.
- Do not publish private operational prompts, wallet material, auth tokens, or private user records.
- Do not claim revenue, market outcomes, or social metrics unless the proof artifact supports the claim.

## Inputs

- Builder name, public handle, and public profile link.
- Agent name, runtime, chain, and public ACP/token links.
- Public proof artifacts: receipts, redacted reports, social posts, or marketplace manifests.
- Offerings/subscriptions/resources JSON when the agent sells services.
- Public operating boundaries and redaction rules.

## Workflow

1. Create a dedicated package folder at `showcase/<project-slug>/`.
2. Keep every project-specific file inside that folder: `README.md`, `showcase.json`, `soul.md`, `agent.yaml`, `offerings/`, `examples/`, and project-specific `skills/`.
3. Do not modify the repository root README for a showcase contribution.
4. Build `showcase.json` with required fields: slug, title, tagline, description, status, topic, topics, builder, links, primitives, visual, skills, artifacts, and exactly three feedback prompts.
5. Link every local skill with `skills[].sourcePath`, and verify that the source path contains `SKILL.md`.
6. Redact sensitive material from receipts and soul context before publishing.
7. Run the repository validator before requesting review.

## Validation

From the repository root, run:

```bash
node scripts/validate-showcase.mjs
```

A valid package should pass manifest validation and keep the root directory free of project-specific files.

## Output Contract

Return:

- Package path.
- Files added or moved.
- Validation command and result.
- Any remaining reviewer notes or risks.
