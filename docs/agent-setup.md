# Agent Setup

Use this repo as the canonical source for reusable ACP agent skills and local agent utilities.

## Skill Source Of Truth

Keep shared skills under `skills/` in this repo. Agent-specific setup should install or link those skills into each agent runtime:

- Codex reads reusable skills from `~/.codex/skills/`.
- Claude Code reads reusable skills from `~/.claude/skills/`.

Each contributed skill should be self-contained under `skills/<skill-name>/`. Put its `SKILL.md`, metadata, references, and validation examples in that folder instead of splitting one skill across separate top-level demo directories.

Shared skill sources:

- [`skills/acp-builder-setup`](../skills/acp-builder-setup) - setup and routing guidance for Codex, Claude Code, and Claude Desktop.
- [`skills/acp-paid-subscription-checkout`](../skills/acp-paid-subscription-checkout) - live local checkout execution for Codex CLI/Desktop local threads and Claude Code.
- [`skills/acp-paid-subscription-checkout-handoff`](../skills/acp-paid-subscription-checkout-handoff) - desktop-safe handoff and evidence review for Claude Desktop or chat-only surfaces.

Public GitHub references are listed in [`docs/skill-packages.md`](skill-packages.md).

This repo also checks in project-scope skill links under `.agents/skills` for Codex and `.claude/skills` for Claude Code. When a builder opens this repo in those tools, the skills are discoverable from the project without a user-level install.

For active development, prefer symlinks so local skill edits are picked up by both tools:

```bash
repo="$HOME/code/virtuals_protocol/acp-cli-demos"

mkdir -p "$HOME/.codex/skills" "$HOME/.claude/skills"

for skill in acp-builder-setup acp-paid-subscription-checkout acp-paid-subscription-checkout-handoff; do
  ln -sfn "$repo/skills/$skill" "$HOME/.codex/skills/$skill"
  ln -sfn "$repo/skills/$skill" "$HOME/.claude/skills/$skill"
done
```

For one-off local installs, copying is fine:

```bash
mkdir -p "$HOME/.codex/skills" "$HOME/.claude/skills"
for skill in acp-builder-setup acp-paid-subscription-checkout acp-paid-subscription-checkout-handoff; do
  rm -rf "$HOME/.codex/skills/$skill" "$HOME/.claude/skills/$skill"
  cp -R "skills/$skill" "$HOME/.codex/skills/$skill"
  cp -R "skills/$skill" "$HOME/.claude/skills/$skill"
done
```

## Model Routing Utilities

Codex and Claude Code need different local routing surfaces when using Virtuals-hosted models:

- Codex custom providers call `/v1/responses`; use [`utilities/model-routing/codex-virtuals-proxy`](../utilities/model-routing/codex-virtuals-proxy).
- Claude Code calls Anthropic-compatible `/v1/messages`; use [`utilities/model-routing/claude-virtuals-router`](../utilities/model-routing/claude-virtuals-router) with `claude-code-router`.

Keep shared utilities in `utilities/` so setup docs, skills, and examples evolve together.

## Desktop Support Matrix

| Surface | Skills from this repo | Virtuals routing utility | Status |
| --- | --- | --- | --- |
| Codex CLI | Yes, via `~/.codex/skills` or repo `.agents/skills` | Yes, via `utilities/model-routing/codex-virtuals-proxy` and `~/.codex/config.toml` | Supported |
| Codex Desktop app | Yes, Codex app loads the same Codex skill system | Yes, Codex app uses the same local agent configuration layers as CLI/IDE | Supported for local threads when the proxy is running |
| Claude Code terminal | Yes, via `~/.claude/skills` or project `.claude/skills` | Yes, via `utilities/model-routing/claude-virtuals-router` and `ccr code` | Supported |
| Claude Desktop app | Yes, for uploadable ZIP packages in `packages/claude-desktop`; not from `~/.claude/skills` | Not via `claude-code-router`; Desktop does not use `ccr code` | Supported for setup/handoff skills only |

### Claude Desktop Notes

Claude Desktop has its own skills surface through Claude settings. Upload the zipped packages in [`packages/claude-desktop`](../packages/claude-desktop) for account-level use. This is separate from Claude Code's local filesystem skills.

The live ACP checkout skill assumes local command execution, `acp-cli`, browser automation, and live payment controls, so it should stay a Claude Code or Codex workflow unless those capabilities are exposed to Desktop through a dedicated MCP server or Desktop extension. Use `acp-paid-subscription-checkout-handoff` in Claude Desktop to prepare a safe handoff prompt or review redacted evidence.

`claude-code-router` is a Claude Code terminal integration. It starts Claude Code with local environment overrides and a local `/v1/messages` router. Claude Desktop will not automatically inherit that router config.
