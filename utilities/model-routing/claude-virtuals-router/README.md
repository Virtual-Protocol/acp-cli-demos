# Claude Virtuals Router

Configuration example for routing Claude Code through Virtuals with [`@musistudio/claude-code-router`](https://github.com/musistudio/claude-code-router).

Claude Code uses the Anthropic Messages API shape. `claude-code-router` exposes `/v1/messages` locally and translates requests to the Virtuals Chat Completions endpoint.

## Run

Install Claude Code and Claude Code Router:

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router
```

Create or update the router config from the repo root:

```bash
scripts/configure-claude-virtuals.mjs virtuals
```

Set your key in the shell that starts the router:

```bash
export VIRTUALS_API_KEY=...
scripts/configure-claude-virtuals.mjs check
ccr code
```

After editing `~/.claude-code-router/config.json`, restart the router:

```bash
ccr restart
```

To choose which model each route uses (and discover available model ids), see
[`docs/model-config.md`](../../../docs/model-config.md).

Restore the previous router provider and route values after the demo:

```bash
scripts/configure-claude-virtuals.mjs restore
ccr restart
```

If no restore state exists, remove the Virtuals provider and Virtuals routes:

```bash
scripts/configure-claude-virtuals.mjs default
ccr restart
```

## Config Notes

The example config points at:

```text
https://compute.virtuals.io/v1/chat/completions
```

It uses the `anthropic` transformer because Claude Code sends Anthropic-style `/v1/messages` requests, while Virtuals accepts OpenAI-style Chat Completions requests.

It also uses the `cleancache` transformer. Claude Code adds Anthropic prompt-cache metadata such as `cache_control` to real `ccr code` requests. Direct local router curls can work without that metadata, while `ccr code` can fail with:

```text
Error from provider(virtuals,claude-opus-4-8: 400):
{"message":"Failed to perform chat completion: Bad Request"}
```

In that case, check that the provider transformer chain includes both `anthropic` and `cleancache`, then restart `ccr`.

The default routes use Claude-family Virtuals models because `claude-code-router` forwards large token cap parameters and some Virtuals OpenAI-family models reject those parameters. If you add a transformer that drops token caps, you can route Claude Code to `openai-gpt-55` instead.
