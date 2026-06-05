# ACP Paid Checkout Handoff Template

```text
Use $acp-paid-subscription-checkout to complete a bounded paid subscription checkout for my ACP agent and verify access.

Target:
- Merchant/subscription: {{merchant_or_subscription}}
- Checkout URL: {{checkout_url}}
- Plan: {{plan_name}}
- Billing cadence: {{billing_cadence}}
- Currency: {{currency}}
- Maximum authorized total: {{max_amount}}

Account:
- Use the ACP agent email, not my personal email.
- Determine the current ACP agent email with acp-cli.
- Stop if the checkout email does not match the ACP agent email.

Payment:
- Use the ACP agent card only.
- If the visible total is {{max_amount}} {{currency}} or less, and the plan and cadence exactly match this prompt, this is my explicit authorization to issue the ACP agent card, enter the card details, and click the final paid checkout button.
- Stop before paying if the plan, cadence, amount, email, or payment method differs.
- Skip optional app prompts, recommendation screens, wallet saves, Link saves, public notes, group plans, gift plans, and upsells unless explicitly required above.

Verification:
- Verify paid access in the merchant account.
- Check ACP card/payment status.
- Check ACP agent email for receipt details.
- Redact full card number, CVV, OTPs, magic links, and payment secrets from the final answer.

Final answer:
- State whether checkout succeeded.
- Include amount captured, invoice or receipt number, subscription period, and paid-access verification result when available.
- Mention any renewal limitation or follow-up.
```
