# Utilities

Utilities are shared local helpers used by multiple skills or setup flows. Keep them grouped by purpose instead of by individual demo.

## Model Routing

Use `model-routing/` for adapters that let local agent tools use Virtuals-hosted models:

- [`model-routing/codex-virtuals-proxy`](model-routing/codex-virtuals-proxy) translates Codex Responses API requests to Virtuals Chat Completions.
- [`model-routing/claude-virtuals-router`](model-routing/claude-virtuals-router) provides the `claude-code-router` config for Claude Code.

Skill-specific helpers should stay inside that skill folder unless they are useful to more than one skill.
