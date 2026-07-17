# Skills

Each contributed skill should live in one folder under `skills/`.

Recommended layout:

```text
skills/<skill-name>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   └── ...
└── examples/
    └── ...
```

`SKILL.md` is the required agent-facing entrypoint. Use `references/` for detailed guidance that should be loaded only when needed, and `examples/` for concrete prompts, redacted results, or validation notes tied to that skill.

Do not split one contributed skill across a separate top-level demo folder. For example, the paid Substack example belongs under [`acp-paid-subscription-checkout/examples/substack`](acp-paid-subscription-checkout/examples/substack) because it validates that skill.
