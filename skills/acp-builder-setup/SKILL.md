---
name: acp-builder-setup
description: Set up ACP builder workflows for Codex, Claude Code, and Claude Desktop. Use when installing ACP skills, configuring Codex or Claude to use Virtuals-hosted models, or checking builder environment readiness.
---

# ACP Builder Setup

Use this skill when helping a builder prepare Codex or Claude for ACP demos, skills, and Virtuals-hosted model routing.

## Surface Selection

First identify the target surface:

- **Codex CLI or Codex Desktop local thread**: can use local files, `acp-cli`, `~/.agents/skills`, and `~/.codex/config.toml`.
- **Claude Code terminal**: can use local files, `acp-cli`, `~/.claude/skills`, and `claude-code-router`.
- **Claude Desktop app**: uses uploaded Skills from Claude settings. It does not automatically read `~/.claude/skills` or `claude-code-router`.

If the target surface is unclear, ask which tool they are setting up before changing files.

## Skill Installation

Use this repo as the source of truth. Prefer symlinks for local development and copies for one-off installs.

For exact commands, read `references/setup-commands.md`.

Do not assume repo-scoped `.agents/skills` or `.claude/skills` folders exist. This repo keeps canonical skills directly under `skills/`, then installs or links them into each local runtime.

Install these local-execution skills for Codex CLI/Desktop and Claude Code:

- `acp-builder-setup`
- `acp-paid-subscription-checkout`
- `acp-paid-subscription-checkout-handoff`

Install these Claude Desktop upload packages:

- `packages/claude-desktop/acp-builder-setup.zip`
- `packages/claude-desktop/acp-paid-subscription-checkout-handoff.zip`

Do not upload the live `acp-paid-subscription-checkout` skill to Claude Desktop unless the user has a separate local-tool bridge. That skill assumes local command execution, browser automation, and live payment controls.

## Model Routing

Codex and Claude Code need different local routing utilities:

- Codex: run `utilities/model-routing/codex-virtuals-proxy`, then point `~/.codex/config.toml` at `http://127.0.0.1:8787/v1`.
- Claude Code: use `utilities/model-routing/claude-virtuals-router/config.example.json` with `claude-code-router`.
- Claude Desktop: do not claim the local router works. Desktop does not inherit `ccr code` or Codex proxy settings.

## Environment Checks

When local terminal tools are available:

1. Confirm Node.js 22 or newer for the Codex proxy.
2. Confirm `VIRTUALS_API_KEY` is set before starting model-routing utilities.
3. Confirm `acp-cli` is installed before running ACP workflows.
4. Run only read-only ACP checks unless the user explicitly authorizes provisioning, card issuance, or paid checkout.

## Output

End with:

- Which surface was configured.
- Which skills were installed or packaged.
- Which router, if any, was configured.
- Any manual action still needed, especially Claude Desktop ZIP upload or skill toggles.
