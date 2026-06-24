---
name: acp-builder-setup
description: Set up ACP builder workflows for Codex, Claude Code, and Claude Desktop. Use when installing ACP skills, configuring Codex or Claude to use Virtuals-hosted models, or checking builder environment readiness.
---

# ACP Builder Setup

Use this skill to help a builder get ready to run ACP demos and skills. There are
two separate jobs, and they have very different stakes:

1. **Install the ACP skill** — required. Just copies files into the agent
   runtime. Safe.
2. **Route through Virtuals for free credits** — optional. Edits the user's
   global agent config. Fully reversible, but get the user's OK first.

Do flow 1 for everyone. Only do flow 2 if the user wants to use Virtuals' free
inference credits instead of their own Anthropic/OpenAI account.

## Surface Selection

First identify the target surface — it decides which commands apply:

- **Codex CLI or Codex Desktop local thread**: can use local files, `acp-cli`, `~/.agents/skills`, and `~/.codex/config.toml`.
- **Claude Code terminal**: can use local files, `acp-cli`, `~/.claude/skills`, and `claude-code-router`.
- **Claude Desktop app**: uses uploaded Skills from Claude settings. It does **not** read `~/.claude/skills` or `claude-code-router`, so flow 2 (routing) does not apply — use the ZIP upload path instead.

If the target surface is unclear, ask which tool they are setting up before changing files.

## 1. Install the ACP skill (required)

This installs the demo skills into the runtime. It only copies or links files —
no global config is touched.

Use this repo as the source of truth. Prefer symlinks for local development and
copies for one-off installs. For exact commands, read [`references/setup-commands.md`](references/setup-commands.md).

Do not assume repo-scoped `.agents/skills` or `.claude/skills` folders exist.
This repo keeps canonical skills directly under `skills/`, then installs or links
them into each local runtime.

Install these local-execution skills for Codex CLI/Desktop and Claude Code:

- `acp-builder-setup`
- `acp-paid-subscription-checkout`

Install these Claude Desktop upload packages:

- [`packages/claude-desktop/acp-builder-setup.zip`](../../packages/claude-desktop/acp-builder-setup.zip)
- [`packages/claude-desktop/acp-paid-subscription-checkout.zip`](../../packages/claude-desktop/acp-paid-subscription-checkout.zip)

In Claude Desktop, the combined checkout skill must use handoff or evidence-review
mode unless the user has a separate local-tool bridge. Live checkout execution
assumes local command execution, browser automation, and live payment controls.

## 2. (Optional) Route through Virtuals for free credits

Optional perk: point the agent at Virtuals-hosted models so inference is billed to
**Virtuals credits instead of the user's own account**. Skip this entirely on
Claude Desktop — it can't use `ccr` or the proxy.

The exact commands and the lifecycle diagrams live elsewhere — do not restate them
here:

- [`references/setup-commands.md`](references/setup-commands.md) — copy-paste commands (bundled with this skill).
- [`docs/agent-setup.md`](../../docs/agent-setup.md) — human walkthrough with diagrams, the three moving parts (config switcher / proxy / agent runtime), and recovery.

Your job is to run that lifecycle **safely**. Three behaviors:

**Explain the mental model first.** Routing ON → the agent spends Virtuals
credits, not the user's Anthropic/OpenAI account (even though it still looks like
"their" Claude/Codex). Routing OFF → back on their own account. Fully reversible.

**Confirm before mutating config.** The lifecycle is `make claude-on` / `make
claude-off` (Claude Code) and `make codex-on` / `make codex-off` (Codex), run from
the repo root with `VIRTUALS_API_KEY` set. These edit the user's global config
(`~/.claude-code-router/config.json`, `~/.codex/config.toml`), so treat them like
provisioning: recommend the exact command for the detected surface, say it's
reversible, and wait for explicit authorization. `make claude-check` is read-only
— run it freely.

**Always offer teardown.** Whenever routing is on (or you just turned it on), tell
the user the one command back to their own account: `make claude-off` or `make
codex-off`. If teardown fails, point them at the "Recover" section of
[`docs/agent-setup.md`](../../docs/agent-setup.md).

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
- Whether Virtuals routing was left **ON** (using Virtuals credits) or **OFF** (on the user's own account), and the command to turn it off (`make claude-off` / `make codex-off`).
- Any manual action still needed, especially Claude Desktop ZIP upload or skill toggles.
