# Paid Substack Subscription Demo

This demo shows an ACP agent subscribing to a paid Substack plan using its own agent email and agent virtual card.

The first validation run used The Pragmatic Engineer Substack. The checkout was completed with an ACP agent email, a bounded ACP agent card, browser automation, and `acp-cli` verification.

## Recommended Usage

From the repo root, install the reusable skill first:

```bash
mkdir -p ~/.codex/skills
cp -R skills/acp-paid-subscription-checkout ~/.codex/skills/
```

Then give the agent a short task-specific request:

```text
Use $acp-paid-subscription-checkout.

Subscribe my ACP agent email to The Pragmatic Engineer Substack individual monthly paid plan and verify that it worked.

Use a $20 USD maximum checkout cap. Do not choose annual, group, gift, app, recommendation, wallet-save, Link-save, or public-note options. Stop if the email is not my ACP agent email, the plan is not individual monthly, or the total is over $20 USD.
```

For Claude Code, install the same skill under `~/.claude/skills/` and invoke `/acp-paid-subscription-checkout` with the same task details.

## What This Demonstrates

- The agent determines its own email identity with `acp email whoami`.
- The agent uses that email for the Substack subscription.
- The agent confirms the visible checkout plan, cadence, and amount before issuing a card.
- The agent issues a bounded single-use card with `acp card issue`.
- The agent completes browser checkout only if the user-authorized constraints match.
- The agent checks payment status with `acp card get`.
- The agent checks the receipt with `acp email search` and `acp email thread`.
- The agent verifies paid access by opening a paid article and confirming full content is visible.

## Files

- [`../../skills/acp-paid-subscription-checkout`](../../skills/acp-paid-subscription-checkout) - reusable skill and recommended entrypoint
- [`prompt.md`](prompt.md) - full raw prompt used for the original validation run; useful as a reference or fallback when a skill system is not available
- [`result-redacted.md`](result-redacted.md) - redacted validation result from the first successful run

## Safety Notes

This is a live-money flow. Keep the maximum spend explicit, and require the agent to stop if the amount, plan, cadence, email, payment method, or checkout flow differs from the authorization.

Do not publish full card numbers, CVVs, magic links, OTPs, or other sensitive payment details.
