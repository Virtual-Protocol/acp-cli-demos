# Showcase Project

## What shipped

- Project slug: de9en-attention-markets
- Project title: De9en — Attention Markets
- Builder name and URL: de9en — https://github.com/de9enfun
- EconomyOS primitives used: acp
- Public proof: Live dashboard https://de9en.fun/dashboard and live per-market share card https://de9en.fun/share/unipcs-vs-orangie ; plus a redacted deliverable envelope and offerings catalog committed in this package
- Optional soul.md: showcase/de9en-attention-markets/soul.md (public, redacted)

## Project package

- [x] Added or updated `showcase/de9en-attention-markets/showcase.json`
- [x] Added demo artifacts, prompt, proof, or redacted report
- [x] Added reusable skill under `showcase/de9en-attention-markets/skills/acp-attention-market-signal/`
- [x] Used top-level `skills/<skill-name>/` only when the skill is shared across projects (n/a — project-specific)
- [x] Set `skills[].sourcePath` in `showcase.json` for the committed skill
- [x] Linked all public artifacts from the manifest
- [x] Included exactly three feedback prompts
- [ ] Set `hidden: true` only if this package should merge without publishing its public Showcase card yet
- [x] Linked `soul.md` (public, redacted agent context)

## Skill standard

- Skill path: showcase/de9en-attention-markets/skills/acp-attention-market-signal
- [x] `SKILL.md` includes when to use it and when not to use it
- [x] Inputs, tools, credentials, and preconditions are explicit
- [x] Approval gates are listed (server-side gate; read-only; escalation in soul.md)
- [x] Stop conditions and handoff rules are listed
- [x] Validation checks and output contract are included

## Safety and redaction

- [x] No card numbers, CVVs, OTPs, magic links, API keys, access tokens, private prompts, wallet material, or private account records are published
- [x] Live workflow evidence is redacted (deliverable envelope carries no internals)
- [x] Public/private boundaries are explained (live product vs. ACP reference rail)
- [x] `soul.md` contains no private instructions, credentials, account data, wallet material, or operational secrets

## Notes

The De9en attention market is live at de9en.fun (public dashboard, KOL Wars grid,
per-market share cards). This package contributes the ACP rail as a reusable
provider skill and design contract; no on-chain job settlement is claimed. The
skill generalizes to any live prediction/attention market that produces
read-only quotes.
