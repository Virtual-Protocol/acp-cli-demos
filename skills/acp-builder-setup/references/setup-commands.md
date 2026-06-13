# ACP Builder Setup Commands

## Symlink Skills For Local Development

```bash
scripts/install-local-skills.sh --mode symlink --target both
```

## Copy Skills For One-Off Installs

```bash
scripts/install-local-skills.sh --mode copy --target both
```

## Codex Virtuals Proxy

```bash
cd utilities/model-routing/codex-virtuals-proxy
cp .env.example .env
# edit .env and set VIRTUALS_API_KEY
npm start
```

In another terminal from the repo root, activate Codex routing through the local proxy:

```bash
scripts/configure-codex-virtuals.mjs virtuals
```

This updates `~/.codex/config.toml` to use:

```toml
model = "gpt-5.5"
model_provider = "virtuals_proxy"

[model_providers.virtuals_proxy]
name = "Virtuals via local Responses proxy"
base_url = "http://127.0.0.1:8787/v1"
wire_api = "responses"
```

The Codex config uses the ChatGPT/Codex-supported `gpt-5.5` model id. The local proxy translates it to the Virtuals upstream model id `openai-gpt-55` when forwarding requests.

Restore the previous Codex model/provider after the demo:

```bash
scripts/configure-codex-virtuals.mjs restore
```

If no restore state exists, switch back to built-in Codex routing:

```bash
scripts/configure-codex-virtuals.mjs default
```

## Claude Code Virtuals Router

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router

export VIRTUALS_API_KEY=...
scripts/configure-claude-virtuals.mjs virtuals
scripts/configure-claude-virtuals.mjs check
ccr restart
ccr code
```

Restore the previous Claude Code Router provider/routes after the demo:

```bash
scripts/configure-claude-virtuals.mjs restore
ccr restart
```

If no restore state exists, remove the Virtuals provider/routes:

```bash
scripts/configure-claude-virtuals.mjs default
ccr restart
```

## Claude Desktop Upload

Upload these ZIPs from Claude settings:

- `packages/claude-desktop/acp-builder-setup.zip`
- `packages/claude-desktop/acp-paid-subscription-checkout.zip`

After upload, enable each skill in Claude's Skills settings.
