# Codex Virtuals Proxy

Local Responses API adapter for using Virtuals Chat Completions models from Codex.

Codex custom providers call `/v1/responses`. The Virtuals community endpoint currently exposes `/v1/chat/completions`. This utility runs a local server that translates Codex Responses requests to Virtuals Chat Completions requests, then translates the result back to a Responses-shaped payload.

For full Codex and Claude setup guidance, see [`../../../docs/agent-setup.md`](../../../docs/agent-setup.md).

## Run

Requires Node.js 22 or newer.

```bash
cd utilities/model-routing/codex-virtuals-proxy
cp .env.example .env
# edit .env and set VIRTUALS_API_KEY
npm start
```

The proxy listens at `http://127.0.0.1:8787/v1` by default.

## Codex Config

From the repo root, activate Codex routing through this proxy:

```bash
scripts/configure-codex-virtuals.mjs virtuals
```

The script records the previous active Codex model/provider, then updates `~/.codex/config.toml` to use:

```toml
model = "gpt-5.5"
model_provider = "virtuals_proxy"

[model_providers.virtuals_proxy]
name = "Virtuals via local Responses proxy"
base_url = "http://127.0.0.1:8787/v1"
wire_api = "responses"
```

Codex validates the configured model id against Codex-supported model names when you sign in with a ChatGPT account. Keep the config model as `gpt-5.5`; this proxy maps it to Virtuals' upstream `openai-gpt-55` model before forwarding the request.

Restore the previous Codex model/provider after the demo:

```bash
scripts/configure-codex-virtuals.mjs restore
```

If no restore state exists, switch back to built-in Codex routing:

```bash
scripts/configure-codex-virtuals.mjs default
```

If you set `VIRTUALS_PROXY_API_KEY`, run `scripts/configure-codex-virtuals.mjs virtuals --env-key VIRTUALS_PROXY_API_KEY` and export the same value in the shell that starts Codex.

## Environment

- `VIRTUALS_API_KEY` - required upstream Virtuals API key.
- `VIRTUALS_BASE_URL` - optional Virtuals API root, defaults to `https://compute.virtuals.io/v1`.
- `VIRTUALS_PROXY_HOST` - optional bind host, defaults to `127.0.0.1`.
- `VIRTUALS_PROXY_PORT` - optional bind port, defaults to `8787`.
- `VIRTUALS_PROXY_API_KEY` - optional local bearer token required by the proxy.
- `VIRTUALS_PROXY_FORWARD_MAX_TOKENS=1` - optional passthrough for token caps. Leave unset for broad Virtuals model compatibility.

## Notes

This utility is meant for local development. It intentionally avoids storing credentials, and it does not replace a full hosted OpenAI-compatible proxy.
