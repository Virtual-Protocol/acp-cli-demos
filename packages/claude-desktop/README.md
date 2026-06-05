# Claude Desktop Skill Packages

Upload these ZIP files from Claude Desktop or Claude web under Customize > Skills:

- `acp-builder-setup.zip` - safe setup and routing guidance.
- `acp-paid-subscription-checkout-handoff.zip` - safe handoff prompt creation and redacted evidence review.

The live `acp-paid-subscription-checkout` skill is not packaged for Claude Desktop because it assumes local `acp-cli`, browser automation, card issuance, 3DS retrieval, and paid checkout controls. Use the handoff skill in Desktop, then run the live checkout in Codex CLI/Desktop local thread or Claude Code.
