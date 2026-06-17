# Agent Setup

Use this repo as the canonical source for reusable ACP agent skills and local agent utilities.

## Skill Source Of Truth

Keep shared skills under `skills/` in this repo. Agent-specific setup should install or link those skills into each agent runtime:

- Codex reads reusable user skills from `~/.agents/skills/`.
- Claude Code reads reusable skills from `~/.claude/skills/`.

Shared contributed skills should be self-contained under `skills/<skill-name>/` with their `SKILL.md`, metadata, references, and validation examples. Project-specific Showcase skills can live with their project package under `showcase/<project-slug>/skills/<skill-name>/`.

Shared skill sources:

- [`skills/acp-builder-setup`](../skills/acp-builder-setup) - setup and routing guidance for Codex, Claude Code, and Claude Desktop.
- [`skills/acp-paid-subscription-checkout`](../skills/acp-paid-subscription-checkout) - live local checkout execution, desktop-safe handoff, and redacted evidence review.

Public GitHub references are listed in [`docs/skill-packages.md`](skill-packages.md).

This repo does not check in project-scope `.agents/skills` or `.claude/skills` aliases. The canonical source is `skills/`; builders install or symlink the skills they want into their local agent runtime.

For active development, prefer symlinks so local skill edits are picked up by both tools:

```bash
scripts/install-local-skills.sh --mode symlink --target both
```

For one-off local installs, copying is fine:

```bash
scripts/install-local-skills.sh --mode copy --target both
```

## Model Routing Utilities

To discover available model IDs and choose which model each agent uses, see [`docs/model-config.md`](model-config.md).

Codex and Claude Code need different local routing surfaces when using Virtuals-hosted models:

- Codex custom providers call `/v1/responses`; use [`utilities/model-routing/codex-virtuals-proxy`](../utilities/model-routing/codex-virtuals-proxy).
- Claude Code calls Anthropic-compatible `/v1/messages`; use [`utilities/model-routing/claude-virtuals-router`](../utilities/model-routing/claude-virtuals-router) with `claude-code-router`.

For Codex, use the config helper instead of hand-editing `~/.codex/config.toml`:

```bash
scripts/configure-codex-virtuals.mjs virtuals
```

It records the previous active Codex model/provider and can restore it after the demo:

```bash
scripts/configure-codex-virtuals.mjs restore
```

If no restore state exists, switch back to built-in Codex routing:

```bash
scripts/configure-codex-virtuals.mjs default
```

For Claude Code, use the router config helper instead of hand-editing `~/.claude-code-router/config.json`:

```bash
scripts/configure-claude-virtuals.mjs virtuals
```

It records the previous `claude-code-router` provider and route values and can restore them after the demo:

```bash
scripts/configure-claude-virtuals.mjs restore
```

If no restore state exists, remove the Virtuals provider and Virtuals routes:

```bash
scripts/configure-claude-virtuals.mjs default
```

Validate the active router config before starting Claude Code:

```bash
scripts/configure-claude-virtuals.mjs check
```

Keep shared utilities in `utilities/` so setup docs, skills, and examples evolve together.

### Recovering Your Original Config

`restore` reverts to the config from just before the most recent activation; if that snapshot is gone, it automatically falls back to a one-time baseline the first activation saved next to your config:

- Claude Code: `~/.claude-code-router/config.json.before-virtuals.bak`
- Codex: `~/.codex/config.toml.before-virtuals.bak`

You normally never touch these. If you can't run `restore`, or you want the exact frozen original back, copy the baseline in by hand:

```bash
cp ~/.claude-code-router/config.json.before-virtuals.bak ~/.claude-code-router/config.json && ccr restart
# Codex: cp ~/.codex/config.toml.before-virtuals.bak ~/.codex/config.toml, then start a fresh thread
```

## Desktop Support Matrix

| Surface | Skills from this repo | Virtuals routing utility | Status |
| --- | --- | --- | --- |
| Codex CLI | Yes, via explicit install or symlink to `~/.agents/skills` | Yes, via `utilities/model-routing/codex-virtuals-proxy` and `~/.codex/config.toml` | Supported |
| Codex Desktop app | Yes, Codex app loads the same Codex skill system | Yes, Codex app uses the same local agent configuration layers as CLI/IDE | Supported for local threads when the proxy is running |
| Claude Code terminal | Yes, via explicit install or symlink to `~/.claude/skills` | Yes, via `utilities/model-routing/claude-virtuals-router` and `ccr code` | Supported |
| Claude Desktop app | Yes, for uploadable ZIP packages in `packages/claude-desktop`; not from `~/.claude/skills` | Not via `claude-code-router`; Desktop does not use `ccr code` | Supported for setup, handoff, and evidence review |

### Claude Desktop Notes

Claude Desktop has its own skills surface through Claude settings. Upload the zipped packages in [`packages/claude-desktop`](../packages/claude-desktop) for account-level use. This is separate from Claude Code's local filesystem skills.

The combined ACP checkout skill selects handoff or evidence-review mode in Claude Desktop. It must not issue cards, retrieve OTPs, enter payment details, or click paid checkout buttons unless those local capabilities are available through a dedicated MCP server or Desktop extension. Run live checkout execution in Codex CLI/Desktop local thread or Claude Code.

`claude-code-router` is a Claude Code terminal integration. It starts Claude Code with local environment overrides and a local `/v1/messages` router. Claude Desktop will not automatically inherit that router config.
