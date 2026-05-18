# Full Prompt: Paid Substack Subscription

This is the full raw prompt used for the original validation run. If your agent supports skills, prefer installing and invoking [`../../skills/acp-paid-subscription-checkout`](../../skills/acp-paid-subscription-checkout), then provide only the Substack-specific target, plan, spend cap, and verification requirements.

```text
/goal Subscribe my ACP agent email to The Pragmatic Engineer Substack monthly paid plan and verify that it worked.

Use the repo instructions: when interacting with ACP, use acp-cli commands.
Use the available browser automation tool for the Substack website flow.

Account:
- Use my ACP agent email, not my personal email.
- Determine the current agent email with acp-cli.

Subscription:
- Target: The Pragmatic Engineer newsletter.
- Plan: Individual monthly paid subscription only.
- Do not choose annual, group, gift, or extra recommended subscriptions.
- Skip app prompts, recommendation screens, and public support-note prompts.
- Do not save the agent card to Google Wallet or Link.

Payment:
- Use my ACP agent card only.
- Before issuing the card, confirm the monthly checkout amount on the page.
- If the individual monthly plan total is $20 USD or less, this prompt is my explicit confirmation and authorization to issue the agent card, enter the card details, and click the final Subscribe/Pay button to complete the purchase.
- Do not pause at the final Subscribe/Pay button if the amount is $20 USD or less and the plan is the individual monthly plan.
- If the total is over $20 USD, the plan is not individual monthly, the email is not my ACP agent email, or the checkout asks for something unexpected, stop and ask me.
- If card verification or 3DS is required, use acp-cli to retrieve the required code.

Verification:
- Before checkout, if this must be a clean test, search the ACP agent email inbox for existing Pragmatic Engineer/Substack paid receipts and stop if found.
- Verify Substack access changed from free to paid.
- Open a paid article and confirm the full content is visible.
- Check ACP card/payment status with acp-cli and capture the amount charged.
- Check ACP agent email inbox for the receipt and summarize receipt details.
- Do not print full card number, CVV, or sensitive payment details in the final answer.

Autonomy:
- Work end-to-end and only ask if an exception condition is hit.
- Exception conditions: total over $20 USD, wrong plan, wrong email, non-ACP-agent card, failed card issuance, unexpected checkout requirement, or inability to verify paid access.

Final answer:
- Tell me whether the subscription succeeded.
- Include the amount captured, invoice number, subscription period.
- Mention any limitation or follow-up, especially if the card is single-use and renewal may fail.
```
