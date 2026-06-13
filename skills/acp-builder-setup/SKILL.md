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

Install these Claude Desktop upload packages:

- `packages/claude-desktop/acp-builder-setup.zip`
- `packages/claude-desktop/acp-paid-subscription-checkout.zip`

In Claude Desktop, the combined checkout skill must use handoff or evidence-review mode unless the user has a separate local-tool bridge. Live checkout execution assumes local command execution, browser automation, and live payment controls.

## Model Routing

Codex and Claude Code need different local routing utilities:

- Codex: run `utilities/model-routing/codex-virtuals-proxy`, then use `scripts/configure-codex-virtuals.mjs virtuals` from the repo root to point `~/.codex/config.toml` at `http://127.0.0.1:8787/v1`. Codex config must use a Codex-supported model id such as `gpt-5.5`; the local proxy maps that to the upstream Virtuals model id.
- Claude Code: use `scripts/configure-claude-virtuals.mjs virtuals` from the repo root to point `~/.claude-code-router/config.json` at Virtuals through `claude-code-router`.
- Claude Desktop: do not claim the local router works. Desktop does not inherit `ccr code` or Codex proxy settings.

### Codex Config Switching

Use the helper instead of manually editing `~/.codex/config.toml`:

- Switch Codex to the Virtuals proxy: `scripts/configure-codex-virtuals.mjs virtuals`
- Switch back to the exact previous Codex model/provider: `scripts/configure-codex-virtuals.mjs restore`
- If no restore state exists, switch back to built-in Codex routing: `scripts/configure-codex-virtuals.mjs default`

After switching config, start a fresh Codex CLI or Codex Desktop local thread so it picks up the updated provider. Do not stop a proxy that an active Codex thread is still using.

### Claude Code Config Switching

Use the helper instead of manually editing `~/.claude-code-router/config.json`:

- Switch Claude Code Router to Virtuals: `scripts/configure-claude-virtuals.mjs virtuals`
- Check the active router config: `scripts/configure-claude-virtuals.mjs check`
- Switch back to the previous Claude Code Router provider/routes: `scripts/configure-claude-virtuals.mjs restore`
- If no restore state exists, remove Virtuals provider/routes: `scripts/configure-claude-virtuals.mjs default`

After switching config, restart the router with `ccr restart` before launching `ccr code`. The Virtuals provider must include the `cleancache` transformer because Claude Code adds Anthropic prompt-cache metadata that Virtuals Chat Completions can reject.

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
