# ACP Builder Setup Commands

The first-time runbook. Two jobs: install the skill (required), then optionally
route through Virtuals for free credits. For how routing *works* — diagrams, the
three moving parts (config switcher / proxy / runtime), and recovery — see
[`docs/agent-setup.md`](../../../docs/agent-setup.md). Run everything from the repo
root unless noted.

## 1. Install the ACP skill (required)

Symlink for local development (edits picked up by both runtimes):

```bash
scripts/install-local-skills.sh --mode symlink --target both
```

Copy for one-off installs:

```bash
scripts/install-local-skills.sh --mode copy --target both
```

## 2. (Optional) Route through Virtuals for free credits

Routing **ON** = the agent spends Virtuals credits; **OFF** = back on your own
account. Fully reversible.

### Prerequisites

1. **Set your Virtuals API key in the shell** (the `make` targets and the proxy
   inherit it from here):

   ```bash
   export VIRTUALS_API_KEY=...
   ```

2. **Install the tooling for your agent:**

   ```bash
   # Claude Code
   npm install -g @anthropic-ai/claude-code @musistudio/claude-code-router
   # Codex: install the Codex CLI
   ```

### Claude Code

```bash
make claude-on      # activate Virtuals routing, validate, restart ccr
ccr code            # use Claude Code on Virtuals credits
make claude-check   # (read-only) validate the active router config
make claude-off     # restore your previous config, restart ccr
```

### Codex

```bash
make codex-on       # start the local proxy (background) + point Codex at it
codex               # start a FRESH thread so it picks up the new provider
make codex-off      # restore your previous Codex config + stop the proxy
make codex-proxy    # alt: run the proxy in the foreground to watch logs
```

Run `make help` to list every target. For a non-default model, manual recovery,
or how routing works under the hood, see
[`docs/agent-setup.md`](../../../docs/agent-setup.md) and
[`docs/model-config.md`](../../../docs/model-config.md).

## Claude Desktop Upload

Claude Desktop cannot use `ccr`/the proxy. Upload these ZIPs from Claude settings instead:

- [`packages/claude-desktop/acp-builder-setup.zip`](../../../packages/claude-desktop/acp-builder-setup.zip)
- [`packages/claude-desktop/acp-paid-subscription-checkout.zip`](../../../packages/claude-desktop/acp-paid-subscription-checkout.zip)

After upload, enable each skill in Claude's Skills settings.
