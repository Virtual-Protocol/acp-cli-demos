---
name: showcase-test-contribution
description: Assemble and validate a hidden EconomyOS Showcase test contribution package.
version: 0.1.0
---

# Showcase Test Contribution

Use this skill when testing whether a Showcase package contains the expected
metadata, proof links, optional public agent context, and reusable workflow
instructions before a contributor opens a PR.

## Inputs

- Project title, tagline, description, builder name, and builder URL.
- Public proof artifact, preferably an X video when available.
- EconomyOS primitives used by the project.
- Optional public `soul.md` content.
- Redaction notes for any live workflow evidence.

## Workflow

1. Confirm the project is a real EconomyOS workflow, not only an idea.
2. Check that the proof artifact is inspectable by reviewers.
3. Create or update `showcase/<project-slug>/showcase.json`.
4. Add `soul.md` only if the builder wants to publish public agent context.
5. Add reusable workflow instructions under
   `showcase/<project-slug>/skills/<skill-name>/SKILL.md` when the workflow can
   be repeated.
6. Run `node scripts/validate-showcase.mjs`.

## Approval Gates

Stop for explicit approval before spending money, creating accounts, posting
publicly, deploying production changes, or exposing private operational context.

## Stop Conditions

- Public proof is missing.
- Required manifest fields are incomplete.
- The skill source path does not contain `SKILL.md`.
- Any artifact includes secrets, credentials, wallet material, card details, or
  private account records.

## Output

Return the changed package path, validator result, and any fields still needing
maintainer review.
