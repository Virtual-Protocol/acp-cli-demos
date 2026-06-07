# Skill Packages

Use this repo as the public reference point for ACP builder skills.

## Source Skills

Use source skill folders for Codex CLI, Codex Desktop local threads, and Claude Code:

- [`skills/acp-builder-setup`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-builder-setup) - setup and model-routing guidance.
- [`skills/acp-paid-subscription-checkout`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-paid-subscription-checkout) - live local ACP checkout execution, desktop-safe handoff, and redacted evidence review.

Each shared skill folder is a reusable runtime boundary. A skill-specific example should live inside that skill, for example [`skills/acp-paid-subscription-checkout/examples/substack`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-paid-subscription-checkout/examples/substack). Project-specific Showcase skills can instead live inside `showcase/<project-slug>/skills/<skill-name>/`.

Install source skills explicitly with [`scripts/install-local-skills.sh`](https://github.com/Virtual-Protocol/acp-cli-demos/blob/main/scripts/install-local-skills.sh). The repo does not duplicate skills under hidden `.agents/skills` or `.claude/skills` project folders.

## Claude Desktop ZIPs

Use uploadable ZIP packages for Claude Desktop or Claude web Skills:

- [`packages/claude-desktop/acp-builder-setup.zip`](https://github.com/Virtual-Protocol/acp-cli-demos/raw/main/packages/claude-desktop/acp-builder-setup.zip)
- [`packages/claude-desktop/acp-paid-subscription-checkout.zip`](https://github.com/Virtual-Protocol/acp-cli-demos/raw/main/packages/claude-desktop/acp-paid-subscription-checkout.zip)

In Claude Desktop, `acp-paid-subscription-checkout` should use handoff or evidence-review mode only. Live execution still requires local `acp-cli`, browser automation, card issuance, 3DS retrieval, and paid checkout controls.

## Model Routing Utilities

Use these shared utilities when routing Codex or Claude Code through Virtuals-hosted models:

- [`utilities/model-routing/codex-virtuals-proxy`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/utilities/model-routing/codex-virtuals-proxy) - local Responses-to-Chat-Completions adapter for Codex.
- [`utilities/model-routing/claude-virtuals-router`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/utilities/model-routing/claude-virtuals-router) - `claude-code-router` config for Claude Code.

## Regenerate Packages

Run this after editing packaged skill source:

```bash
scripts/package-claude-desktop-skills.sh
```
