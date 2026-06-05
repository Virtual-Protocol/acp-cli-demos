# ACP Builder Setup Commands

## Symlink Skills For Local Development

```bash
repo="$HOME/code/virtuals_protocol/acp-cli-demos"

mkdir -p "$HOME/.codex/skills" "$HOME/.claude/skills"

for skill in acp-builder-setup acp-paid-subscription-checkout acp-paid-subscription-checkout-handoff; do
  ln -sfn "$repo/skills/$skill" "$HOME/.codex/skills/$skill"
  ln -sfn "$repo/skills/$skill" "$HOME/.claude/skills/$skill"
done
```

## Copy Skills For One-Off Installs

```bash
mkdir -p "$HOME/.codex/skills" "$HOME/.claude/skills"

for skill in acp-builder-setup acp-paid-subscription-checkout acp-paid-subscription-checkout-handoff; do
  rm -rf "$HOME/.codex/skills/$skill" "$HOME/.claude/skills/$skill"
  cp -R "skills/$skill" "$HOME/.codex/skills/$skill"
  cp -R "skills/$skill" "$HOME/.claude/skills/$skill"
done
```

## Codex Virtuals Proxy

```bash
cd utilities/codex-virtuals-proxy
cp .env.example .env
VIRTUALS_API_KEY=... npm start
```

Add to `~/.codex/config.toml`:

```toml
model = "openai-gpt-55"
model_provider = "virtuals_proxy"

[model_providers.virtuals_proxy]
name = "Virtuals via local Responses proxy"
base_url = "http://127.0.0.1:8787/v1"
wire_api = "responses"
```

## Claude Code Virtuals Router

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router

mkdir -p "$HOME/.claude-code-router"
cp utilities/claude-virtuals-router/config.example.json \
  "$HOME/.claude-code-router/config.json"

export VIRTUALS_API_KEY=...
ccr code
```

## Claude Desktop Upload

Upload these ZIPs from Claude settings:

- `packages/claude-desktop/acp-builder-setup.zip`
- `packages/claude-desktop/acp-paid-subscription-checkout-handoff.zip`

After upload, enable each skill in Claude's Skills settings.
