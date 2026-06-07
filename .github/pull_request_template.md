# Showcase Project

## What shipped

- Project slug:
- Project title:
- Builder name and URL:
- EconomyOS primitives used:
- Public proof: <!-- X video is highly recommended; screenshot, hosted video, live page, interactive demo, public PR, or redacted report also works -->
- Optional soul.md: <!-- prefer showcase/<project-slug>/soul.md with public/redacted URL and summary, or "none" -->

## Project package

- [ ] Added or updated `showcase/<project-slug>/showcase.json`
- [ ] Added demo artifacts, prompt, proof, or redacted report
- [ ] Added reusable skill under `showcase/<project-slug>/skills/<skill-name>/` when it belongs to this project package
- [ ] Used top-level `skills/<skill-name>/` only when the skill is shared across projects
- [ ] Set `skills[].sourcePath` in `showcase.json` for any skill committed in this repo
- [ ] Linked all public artifacts from the manifest
- [ ] Included exactly three feedback prompts
- [ ] Set `hidden: true` only if this package should merge without publishing its public Showcase card yet
- [ ] Linked `soul.md` only if the builder intentionally wants to publish public, redacted agent context

## Skill standard

- Skill path:
- [ ] `SKILL.md` includes when to use it and when not to use it
- [ ] Inputs, tools, credentials, and preconditions are explicit
- [ ] Approval gates are listed for spending, posting, account creation, deployment, or production mutations
- [ ] Stop conditions and handoff rules are listed
- [ ] Validation checks and output contract are included

## Safety and redaction

- [ ] No card numbers, CVVs, OTPs, magic links, API keys, access tokens, private prompts, wallet material, or private account records are published
- [ ] Live workflow evidence is redacted
- [ ] Public/private boundaries are explained
- [ ] Optional `soul.md` does not include private instructions, credentials, account data, wallet material, or operational secrets

## Publish path

After this PR is approved and merged to `main`, changes under
`showcase/**` trigger the EconomyOS docs sync. The accepted manifest is
published into `/community#showcase` by the docs workflow.
