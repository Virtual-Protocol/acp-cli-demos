# Claude Virtuals Router

Configuration example for routing Claude Code through Virtuals with [`@musistudio/claude-code-router`](https://github.com/musistudio/claude-code-router).

Claude Code uses the Anthropic Messages API shape. `claude-code-router` exposes `/v1/messages` locally and translates requests to the Virtuals Chat Completions endpoint.

## Run

Install Claude Code and Claude Code Router:

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router
```

Create the router config:

```bash
mkdir -p "$HOME/.claude-code-router"
cp utilities/claude-virtuals-router/config.example.json \
  "$HOME/.claude-code-router/config.json"
```

Set your key in the shell that starts the router:

```bash
export VIRTUALS_API_KEY=...
ccr code
```

After editing `~/.claude-code-router/config.json`, restart the router:

```bash
ccr restart
```

## Config Notes

The example config points at:

```text
https://compute.virtuals.io/v1/chat/completions
```

It uses the `anthropic` transformer because Claude Code sends Anthropic-style `/v1/messages` requests, while Virtuals accepts OpenAI-style Chat Completions requests.

The default routes use Claude-family Virtuals models because `claude-code-router` forwards token cap parameters and some Virtuals OpenAI-family models reject those parameters. If you add a transformer that drops token caps, you can route Claude Code to `openai-gpt-55` instead.
