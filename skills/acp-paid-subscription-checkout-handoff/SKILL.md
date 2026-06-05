---
name: acp-paid-subscription-checkout-handoff
description: Prepare or review bounded ACP paid subscription checkout handoffs for desktop or chat-only surfaces. Use when local acp-cli, browser automation, or card tools are unavailable and the user needs a safe handoff prompt or audit.
---

# ACP Paid Subscription Checkout Handoff

Use this skill on Claude Desktop, chat-only surfaces, or any environment that cannot safely run local `acp-cli`, browser automation, and card tools.

This is not the live checkout skill. Do not issue cards, enter payment details, retrieve OTPs, click paid checkout buttons, or ask the user to paste sensitive secrets.

## Workflow

1. Identify the target subscription, plan, billing cadence, amount cap, currency, and ACP agent email requirement.
2. Ask for missing authorization details before drafting a live-run handoff.
3. Produce a handoff prompt for a local execution agent using `acp-paid-subscription-checkout`.
4. If the user provides redacted logs, receipts, card status, or screenshots, review them for consistency with the authorization.
5. If the user wants execution, direct them to run the handoff in Codex CLI/Desktop local thread or Claude Code with the live checkout skill installed.

For a reusable handoff template, read `references/handoff-template.md`.

## Safety Rules

- Do not request or display full PAN, CVV, magic links, OTPs, auth tokens, or payment credentials.
- Do not claim a checkout succeeded from screenshots alone; require payment status, receipt, or paid-access evidence.
- Stop and ask for clarification if the plan, cadence, amount, email, or merchant is ambiguous.
- Treat all payment and identity actions as requiring explicit user authorization.

## Final Answer

Return either:

- A ready-to-run handoff prompt for a local execution agent.
- A review of redacted evidence with pass/fail/uncertain status and the exact missing proof.
