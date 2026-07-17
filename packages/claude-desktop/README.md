# Claude Desktop Skill Packages

Upload these ZIP files from Claude Desktop or Claude web under Customize > Skills:

- `acp-builder-setup.zip` - safe setup and routing guidance.
- `acp-paid-subscription-checkout.zip` - paid checkout handoff and redacted evidence review, with live execution guarded behind local-tool availability.

In Claude Desktop, use `acp-paid-subscription-checkout` for handoff prompts or redacted evidence review. Run live checkout execution in Codex CLI/Desktop local thread or Claude Code unless Desktop has a dedicated local-tool bridge for `acp-cli`, browser automation, card issuance, and 3DS retrieval.
