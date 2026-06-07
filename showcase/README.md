# Showcase Manifests

Showcase projects are published from this repo into the EconomyOS Community
Showcase after the contribution PR is approved and merged.

Each public entry lives in `showcase/<project-slug>/`. The manifest is
`showcase/<project-slug>/showcase.json`, and the same folder can contain the
proof notes, project-specific skill, artifacts, and reviewer context needed by
the docs site.

## End-To-End Flow

1. Build a real EconomyOS workflow and capture public proof.
2. Add the project package under `showcase/<project-slug>/`.
3. Add a project-specific reusable skill under
   `showcase/<project-slug>/skills/<skill-name>/` when the workflow can be
   repeated. Use top-level `skills/<skill-name>/` only when the skill is shared
   across projects.
4. Open a PR against `Virtual-Protocol/acp-cli-demos`.
5. Reviewers check the demo package, redaction, skill quality, and manifest.
6. After merge to `main`, the sync workflow publishes the manifest into the
   EconomyOS docs Showcase data.

The publish step requires the `SHOWCASE_SYNC_TOKEN` repository secret to be set
in `acp-cli-demos`. It should be a GitHub token that can create a repository
dispatch event in `Virtual-Protocol/whitepaper-economyOS`.

## Required Shape

Use the Paid Substack example as the reference:

- `showcase/paid-substack-subscription/showcase.json`
- `skills/acp-paid-subscription-checkout/` as a shared skill source for this
  example
- `skills/acp-paid-subscription-checkout/examples/substack/`

Every manifest needs:

- `slug`, `title`, `tagline`, `description`, `status`, `topic`, and `topics`
- `builder.name` and `builder.url`
- `links.repo`, `links.share`, and `links.feedback`
- `primitives`, using `wallet`, `email`, `card`, `token`, or `acp`
- `visual.kind`, `visual.eyebrow`, and `visual.title`
- `skills`, when the workflow is reusable
- `skills[].sourcePath`, when the skill is committed in this repo and should be
  validated against a local `SKILL.md`
- `artifacts`, including proof and redacted reports for live workflows
- exactly three `feedbackPrompts`

Public proof does not have to be an X video. Use any inspectable artifact that
shows the project or workflow ran: screenshot, hosted video, animated demo, live
page, interactive demo, public PR, demo repo, or redacted result report.

Optional visibility control:

- `hidden: true` keeps the package valid in this repo but prevents the EconomyOS
  docs sync from publishing the card. Remove it in a later PR when the showcase
  should go live.

Optional agent context:

- `soul.md` can be included when the builder intentionally wants to publish
  public agent context. Redact private instructions, credentials, account data,
  wallet material, and operational secrets before linking it from
  `showcase.json` as `soul.href` with a short `soul.summary`.

Run this before requesting review:

```bash
node scripts/validate-showcase.mjs
```
