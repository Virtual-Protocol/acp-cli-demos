# Skill Packages

Use this repo as the public reference point for ACP builder skills.

## Source Skills

Use source skill folders for Codex CLI, Codex Desktop local threads, and Claude Code:

- [`skills/acp-builder-setup`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-builder-setup) - setup and model-routing guidance.
- [`skills/acp-paid-subscription-checkout`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-paid-subscription-checkout) - live local ACP checkout execution.
- [`skills/acp-paid-subscription-checkout-handoff`](https://github.com/Virtual-Protocol/acp-cli-demos/tree/main/skills/acp-paid-subscription-checkout-handoff) - desktop-safe handoff and evidence review.

## Claude Desktop ZIPs

Use uploadable ZIP packages for Claude Desktop or Claude web Skills:

- [`packages/claude-desktop/acp-builder-setup.zip`](https://github.com/Virtual-Protocol/acp-cli-demos/raw/main/packages/claude-desktop/acp-builder-setup.zip)
- [`packages/claude-desktop/acp-paid-subscription-checkout-handoff.zip`](https://github.com/Virtual-Protocol/acp-cli-demos/raw/main/packages/claude-desktop/acp-paid-subscription-checkout-handoff.zip)

The live `acp-paid-subscription-checkout` skill is intentionally not packaged for Claude Desktop. It assumes local `acp-cli`, browser automation, card issuance, 3DS retrieval, and paid checkout controls.

## Regenerate Packages

Run this after editing packaged skill source:

```bash
scripts/package-claude-desktop-skills.sh
```
