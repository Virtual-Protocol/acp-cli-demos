---
name: acp-paid-subscription-checkout
description: Complete bounded paid subscription checkouts using ACP agent email, agent card, browser checkout, receipt checks, and paid-access verification.
---

# ACP Paid Subscription Checkout

## Overview

Use this skill to complete a paid subscription checkout for an ACP agent when the user has provided a target subscription, plan, amount cap, and explicit authorization conditions.

This is a live-money workflow. Keep the user's stated constraints as the source of truth and stop immediately when the checkout no longer matches those constraints.

## Required Rules

- Use `acp-cli` commands for ACP identity, agent email, agent card, payment status, 3DS codes, and receipt checks.
- Use the available browser automation tool for website checkout flows.
- Use the ACP agent email, not the user's personal email.
- Use the ACP agent card only.
- Confirm the checkout page amount, plan, billing cadence, and email before issuing the agent card.
- Do not issue a card or click the final paid checkout button unless the user has explicitly authorized that amount and plan.
- Never print the full PAN, CVV, magic links, OTPs, or sensitive payment details in the final answer.
- Skip optional app prompts, recommendation screens, extra subscriptions, gifts, group plans, wallet saves, Link saves, and public support-note prompts unless the user explicitly requested them.

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

## Final Answer

State:

- Whether the subscription succeeded.
- Amount authorized and amount captured.
- Invoice or receipt number, if present.
- Subscription period, if present.
- Paid-access verification result.
- Any limitation or follow-up, especially if the card is single-use and renewal may fail.

Do not include full card number, CVV, magic links, OTPs, or sensitive payment details.

## References

- For a reusable prompt template, read `references/paid-subscription-template.md`.
- For a concrete Substack validation example, read `references/substack-pragmatic-engineer-example.md`.
