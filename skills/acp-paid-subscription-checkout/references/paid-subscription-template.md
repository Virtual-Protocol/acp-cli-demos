# Paid Subscription Checkout Template

Use this template when asking an agent to run the skill against a new merchant.

```text
/goal Subscribe my ACP agent email to {{subscription_name}} and verify that it worked.

Use acp-cli commands for ACP identity, email, card, payment, 3DS, and receipt checks.
Use the available browser automation tool for the website flow.

Account:
- Use my ACP agent email, not my personal email.
- Determine the current agent email with acp-cli.

Subscription:
- Target: {{subscription_target}}
- Plan: {{plan_name}}
- Billing cadence: {{billing_cadence}}
- Do not choose {{excluded_plan_types_or_upsells}}.
- Skip optional app prompts, recommendation screens, wallet saves, Link saves, public notes, and upsells.

Payment:
- Use my ACP agent card only.
- Before issuing the card, confirm the checkout amount on the page.
- If the total is {{max_amount}} {{currency}} or less and the plan is exactly {{plan_name}} billed {{billing_cadence}}, this prompt is my explicit confirmation and authorization to issue the agent card, enter the card details, and click the final paid checkout button.
- Do not pause at the final paid checkout button if the amount and plan match this authorization.
- If the total is over {{max_amount}} {{currency}}, the plan is wrong, the email is wrong, the payment method is not the ACP agent card, or checkout asks for something unexpected, stop and ask me.
- If card verification or 3DS is required, use acp-cli to retrieve the required code.

Verification:
- Verify access changed from free to paid.
- Open a paid-only page and confirm the full content is visible.
- Check ACP card/payment status with acp-cli and capture the amount charged.
- Check ACP agent email inbox for the receipt and summarize receipt details.
- Do not print full card number, CVV, or sensitive payment details in the final answer.

Final answer:
- Tell me whether the subscription succeeded.
- Include amount captured, invoice or receipt number, and subscription period when available.
- Mention limitations or follow-up, especially if the card is single-use and renewal may fail.
```

Before reusing the template, replace every `{{placeholder}}` and keep the amount cap explicit.
