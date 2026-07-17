---
name: acp-paid-subscription-checkout
description: Complete, hand off, or review bounded paid subscription checkouts using ACP agent email, agent card, browser checkout, receipt checks, and paid-access verification. Use live mode only when local acp-cli, browser automation, and card tools are available; use handoff or evidence-review mode on desktop or chat-only surfaces.
---

# ACP Paid Subscription Checkout

## Overview

Use this skill for bounded ACP paid subscription checkout workflows. It supports three modes:

- **Live execution**: complete the checkout with local `acp-cli`, browser automation, ACP agent email, ACP agent card, receipt checks, and paid-access verification.
- **Handoff**: prepare a safe ready-to-run prompt for a local execution agent when this surface cannot run local tools.
- **Evidence review**: review redacted logs, receipts, card status, and screenshots after another agent ran the checkout.

This is a live-money workflow in live execution mode. Keep the user's stated constraints as the source of truth and stop immediately when the checkout no longer matches those constraints.

## Mode Selection

Before acting, choose exactly one mode:

1. Use **live execution mode** only if local command execution, `acp-cli`, browser automation, and ACP card/email tools are available.
2. Use **handoff mode** on Claude Desktop, chat-only surfaces, or any environment that cannot safely run local `acp-cli`, browser automation, and card tools.
3. Use **evidence review mode** when the user provides redacted receipts, logs, card status, email evidence, or screenshots and asks whether a checkout succeeded.

In handoff or evidence review mode, do not issue cards, enter payment details, retrieve OTPs, click paid checkout buttons, or ask the user to paste sensitive secrets.

## Required Rules

- Use `acp-cli` commands for ACP identity, agent email, agent card, payment status, 3DS codes, and receipt checks.
- Use the available browser automation tool for website checkout flows.
- Use the ACP agent email, not the user's personal email.
- Use the ACP agent card only.
- Confirm the checkout page amount, plan, billing cadence, and email before issuing the agent card.
- Do not issue a card or click the final paid checkout button unless the user has explicitly authorized that amount and plan.
- Never print the full PAN, CVV, magic links, OTPs, or sensitive payment details in the final answer.
- Skip optional app prompts, recommendation screens, extra subscriptions, gifts, group plans, wallet saves, Link saves, and public support-note prompts unless the user explicitly requested them.

These required rules apply to live execution mode. In handoff mode, include these same constraints in the handoff prompt instead of executing them.

## Stop Conditions

Stop and ask the user before paying if any of these occur:

- The total exceeds the authorized cap.
- The selected plan is not the requested plan.
- The billing cadence is not the requested cadence.
- The checkout email is not the ACP agent email.
- The payment method is not the ACP agent card.
- The test requires a previously unsubscribed account, but ACP email history already shows paid receipts, welcome emails, or other evidence that the account is subscribed.
- The checkout requests an unexpected upsell, wallet save, Link save, public note, app install, group, gift, tax, identity, or address step that could affect the purchase.
- ACP email, card setup, card issuance, 3DS retrieval, payment status, receipt lookup, or paid-access verification fails.

## ACP Command Pattern

Prefer the installed `acp` binary:

```bash
acp email whoami --json
acp card whoami --json
acp card profile --json
acp card payment-method --json
acp card limit --json
acp card issue --amount <cents> --json
acp card 3ds --json
acp card list --json
acp card get --request-id <id> --json
acp email search --query "<merchant receipt query>" --json
acp email thread --thread-id <id> --json
```

If working from an `acp-cli` source checkout, use the repo wrapper instead:

```bash
npm run acp -- email whoami --json
npm run acp -- card issue --amount <cents> --json
```

Treat card details returned by `card issue` as one-time secrets. Store them only in transient working context for checkout entry, then redact them from notes and final output.

## Workflow

1. Read the user's target subscription, required plan, billing cadence, amount cap, and stop conditions.
2. Determine the ACP agent email with `acp email whoami --json`; provision with `acp email provision --json` only if the user authorized provisioning and no identity exists.
3. If this is a clean-account test, search ACP email for prior merchant receipts, welcome emails, and subscription confirmations before opening checkout.
4. Check card readiness with `acp card whoami --json`, `acp card profile --json`, `acp card payment-method --json`, and `acp card limit --json`.
5. Open the target subscription page with the available browser automation tool.
6. Select only the requested paid plan and cadence.
7. Confirm the visible total is within the user-authorized cap and the email field matches the ACP agent email.
8. Issue the ACP agent card for the checkout total rounded up to the merchant charge amount in cents.
9. Enter card details in the browser and submit the final paid checkout only if the user's authorization conditions are still satisfied.
10. If 3DS is requested, poll `acp card 3ds --json` and enter the matching recent code.
11. Decline wallet, Link, app, recommendation, and optional-public-note prompts unless explicitly requested.
12. Verify the account is paid by opening a paid-only page and confirming full content is visible.
13. Check the card request status with `acp card list --json` and `acp card get --request-id <id> --json`; capture the charged amount and status.
14. Search the ACP agent email inbox for the receipt and summarize receipt details.

## Handoff Workflow

Use handoff mode when local execution is unavailable.

1. Identify the target subscription, checkout URL, plan, billing cadence, currency, maximum amount, and ACP agent email requirement.
2. Ask for missing authorization details before drafting a live-run handoff.
3. Produce a ready-to-run prompt for a local execution agent using this same skill.
4. Tell the user to run the prompt in Codex CLI/Desktop local thread or Claude Code with the skill installed.

For the reusable handoff template, read `references/handoff-template.md`.

## Evidence Review Workflow

Use evidence review mode when the user provides redacted proof from a checkout run.

1. Compare the merchant, plan, billing cadence, amount, currency, and email against the authorization.
2. Require at least one payment proof source, such as ACP card status, merchant receipt, invoice, or paid-access evidence.
3. Treat screenshots alone as insufficient proof of success.
4. Return pass, fail, or uncertain status with the exact missing evidence.

## Final Answer

In live execution mode, state:

- Whether the subscription succeeded.
- Amount authorized and amount captured.
- Invoice or receipt number, if present.
- Subscription period, if present.
- Paid-access verification result.
- Any limitation or follow-up, especially if the card is single-use and renewal may fail.

Do not include full card number, CVV, magic links, OTPs, or sensitive payment details.

In handoff mode, return a ready-to-run handoff prompt. In evidence review mode, return pass/fail/uncertain status and the missing proof, if any.

## References

- For a reusable prompt template, read `references/paid-subscription-template.md`.
- For a handoff prompt template, read `references/handoff-template.md`.
- For a concrete Substack validation example, read `examples/substack/pragmatic-engineer.md`.
- For the original Substack prompt and redacted result, read `examples/substack/prompt.md` and `examples/substack/result-redacted.md`.
