# ACP Builder Setup Commands

Two jobs: install the skill (required), and optionally route through Virtuals for
free credits (reversible — see the on/off lifecycle below). Run everything from
the repo root unless noted.

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

Routing ON = the agent spends **Virtuals credits**; routing OFF = back on your
**own account**. Set `VIRTUALS_API_KEY` in the shell first. The `make` targets
are the simple path — they wrap the scripts and handle restart/proxy/restore.

```
                make claude-on / make codex-on
   YOUR ACCOUNT ──────────────────────────────▶ VIRTUALS CREDITS
                ◀──────────────────────────────
                make claude-off / make codex-off
```

### Claude Code

```
make claude-on   →  ccr code  →  make claude-off
[turn ON]           [use it]      [back to your account]
```

```bash
# one-time installs
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router

export VIRTUALS_API_KEY=...
make claude-on      # activate Virtuals routing, validate, restart ccr
ccr code            # use Claude Code on Virtuals credits
make claude-check   # (read-only) validate the active router config
make claude-off     # restore your previous config, restart ccr
```

### Codex

```
make codex-on   →  codex  →  make codex-off
[turn ON +          [use]      [back to your account
 start proxy]                  + stop proxy]
```

```bash
export VIRTUALS_API_KEY=...
make codex-on       # start the local proxy (background) + point Codex at it
codex               # start a FRESH thread so it picks up the new provider
make codex-off      # restore your previous Codex config + stop the proxy
make codex-proxy    # alt: run the proxy in the foreground to watch logs
```

Run `make help` to list every target.

## Advanced / custom model

The `make` targets call these scripts. Use them directly only for a non-default
model, the proxy in the foreground, or manual recovery. For choosing model ids,
see [`docs/model-config.md`](../../../docs/model-config.md).

Codex proxy in the foreground (instead of `make codex-on`'s background proxy):

```bash
cd utilities/model-routing/codex-virtuals-proxy
cp .env.example .env
# edit .env and set VIRTUALS_API_KEY
npm start
```

`make codex-on` writes this block to `~/.codex/config.toml`:

```toml
model = "gpt-5.5"
model_provider = "virtuals_proxy"

[model_providers.virtuals_proxy]
name = "Virtuals via local Responses proxy"
base_url = "http://127.0.0.1:8787/v1"
wire_api = "responses"
```

The Codex config uses the Codex-supported `gpt-5.5` model id; the local proxy
translates it to the Virtuals upstream id `openai-gpt-55` when forwarding.

Direct config-switcher verbs (both agents support `virtuals | restore | default | check`):

```bash
scripts/configure-codex-virtuals.mjs restore     # exact previous model/provider
scripts/configure-codex-virtuals.mjs default     # built-in Codex routing (no restore state)

scripts/configure-claude-virtuals.mjs restore && ccr restart   # previous provider/routes
scripts/configure-claude-virtuals.mjs default && ccr restart   # remove Virtuals routes
```

If a `restore` cannot run, see "Recovering Your Original Config" in
[`docs/agent-setup.md`](../../../docs/agent-setup.md).

## Claude Desktop Upload

Claude Desktop cannot use `ccr`/the proxy. Upload these ZIPs from Claude settings instead:

- [`packages/claude-desktop/acp-builder-setup.zip`](../../../packages/claude-desktop/acp-builder-setup.zip)
- [`packages/claude-desktop/acp-paid-subscription-checkout.zip`](../../../packages/claude-desktop/acp-paid-subscription-checkout.zip)

After upload, enable each skill in Claude's Skills settings.
