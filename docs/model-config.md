# Choosing and Configuring the Model

Virtuals-hosted models are served from `https://compute.virtuals.io/v1`. The
model is a configuration parameter, but it lives in a different place for Codex
versus Claude Code. This guide covers how to discover valid model IDs and where
to set them. For activating the routing surfaces themselves, see
[`docs/agent-setup.md`](agent-setup.md).

## 1. Discover available models

The endpoint exposes a live model list. Query it before editing any config so
you copy an exact, currently-valid `id`:

```bash
curl -s https://compute.virtuals.io/v1/models \
  -H "Authorization: Bearer $VIRTUALS_API_KEY" \
  | jq -r '.data[] | "\(.id)  (\(.contextLength) ctx)"'
```

The `id` field is the exact string configs expect. Example output:

```
claude-opus-4-8  (1000000 ctx)
claude-opus-4-7-fast  (1000000 ctx)
claude-fable-5  (1000000 ctx)
deepseek-v4-pro  (1000000 ctx)
gemini-3-flash-preview  (1000000 ctx)
venice-uncensored-1-2  (128000 ctx)
```

The available set changes over time. Treat this endpoint as the source of
truth, not any model list hard-coded in a README or example config.

## 2. Set the model for Codex

Codex reads `~/.codex/config.toml`. The model is the top-level `model` key,
which must point at a provider block:

```toml
model = "claude-opus-4-8"        # any id from step 1
model_provider = "virtuals_proxy"

[model_providers.virtuals_proxy]
name = "Virtuals via local Responses proxy"
base_url = "http://127.0.0.1:8787/v1"
wire_api = "responses"
```

Prefer the helper over hand-editing — it preserves and can restore your
previous model/provider:

```bash
scripts/configure-codex-virtuals.mjs virtuals   # activate Virtuals routing
scripts/configure-codex-virtuals.mjs restore    # back to previous model/provider
scripts/configure-codex-virtuals.mjs default    # back to built-in Codex routing
```

To change which Virtuals model Codex uses, edit the `model` value in
`~/.codex/config.toml` to another `id` from step 1, then restart Codex. The
local proxy in
[`utilities/model-routing/codex-virtuals-proxy`](../utilities/model-routing/codex-virtuals-proxy)
must be running.

## 3. Set the model for Claude Code

Claude Code (via `claude-code-router`) reads
`~/.claude-code-router/config.json`. The model appears in **two** places that
must agree:

```jsonc
{
  "Providers": [{
    "name": "virtuals",
    "api_base_url": "https://compute.virtuals.io/v1/chat/completions",
    "api_key": "$VIRTUALS_API_KEY",
    "models": [                 // allowlist: a model must be listed here to be usable
      "claude-opus-4-8",
      "claude-opus-4-7-fast"
    ],
    "transformer": { "use": ["anthropic", "cleancache"] }
  }],
  "Router": {                   // which model serves each scenario
    "default":     "virtuals,claude-opus-4-7-fast",
    "background":  "virtuals,claude-opus-4-7-fast",
    "think":       "virtuals,claude-opus-4-8",
    "longContext": "virtuals,claude-opus-4-8"
  }
}
```

- `Router` values are `"<provider-name>,<model-id>"`.
- Every model named in `Router` must also appear in that provider's `models[]`.
- The four `Router` keys let you route cheaper/faster models to background and
  default work while reserving a stronger model for `think` and `longContext`.

> **Note:** the router remaps every request to the model in the matching
> `Router` route, regardless of the model id sent in the request. A request that
> names `claude-opus-4-8` but matches the `default` route is served by
> `default`'s model, not the requested one. To run a specific model you must set
> it on the route that request will hit. Most interactive Claude Code use hits
> the `default` route.

### Set the model on a route

There are two ways. Either edits the same file —
`~/.claude-code-router/config.json`.

**Option A — helper flags (preferred).** Run from the repo root. The helper
writes the routes and keeps `models[]` in sync:

```bash
# --model sets the default AND background routes
# --think-model sets the think AND longContext routes
# --models is the provider allowlist (every routed model must be listed here)
scripts/configure-claude-virtuals.mjs virtuals \
  --model claude-opus-4-8 \
  --think-model claude-opus-4-8 \
  --models claude-opus-4-8,claude-opus-4-7-fast
```

**Option B — hand-edit.** Open `~/.claude-code-router/config.json` and change
the value of the route you want under `Router`. The value format is
`"<provider-name>,<model-id>"`. To make every interactive request use
`claude-opus-4-8`:

```jsonc
"Router": {
  "default":     "virtuals,claude-opus-4-8",   // <- interactive requests hit this
  "background":  "virtuals,claude-opus-4-7-fast",
  "think":       "virtuals,claude-opus-4-8",
  "longContext": "virtuals,claude-opus-4-8"
}
```

Whichever route you edit, the model id must also be present in
`Providers[].models[]`.

### Other helper commands

```bash
scripts/configure-claude-virtuals.mjs check      # validate the active config
scripts/configure-claude-virtuals.mjs restore    # back to previous provider/routes
scripts/configure-claude-virtuals.mjs default    # remove Virtuals routes
```

Run `check` before starting Claude Code, then restart the router after any
config change (`ccr restart`, or `ccr stop && ccr code`).

## 4. Confirm traffic reaches Virtuals

Send a request straight at the endpoint and look for the `venice_parameters`
object in the response — its presence confirms the request was served by the
Virtuals compute endpoint:

```bash
curl -s https://compute.virtuals.io/v1/chat/completions \
  -H "Authorization: Bearer $VIRTUALS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-opus-4-8","max_tokens":20,
       "messages":[{"role":"user","content":"reply: VIRTUALS OK"}]}'
```
