# Hatcher Virtuals ACP Workbench - Redacted Result Report

## Public Proof

- Demo video: https://youtu.be/DvtjysrHfzs
- Builder: Hatcher Labs
- Site: https://hatcher.host
- Public ACP explorer: https://app.virtuals.io/acp/scan

## Flow Captured

1. Opened a Hatcher-managed agent.
2. Confirmed Virtuals appears as an inference provider in agent configuration.
3. Opened `Wallet -> Virtuals`.
4. Used the Virtuals access and budget-control panel.
5. Searched the Virtuals ACP marketplace for providers.
6. Reviewed ACP provider and offering information.
7. Prepared a review-first job draft rather than executing a funded ACP action immediately.
8. Opened the HatcherLabs services area for service packaging and publish preparation.

## Redacted Draft Shape

```json
{
  "client": "Hatcher-managed agent",
  "provider": {
    "name": "[redacted provider display name from marketplace search]",
    "walletAddress": "[redacted public wallet/address in video context]"
  },
  "offering": {
    "name": "[redacted selected offering]",
    "priceType": "fixed-or-marketplace-defined"
  },
  "budget": {
    "maxPerJobUsd": "[operator-controlled limit]",
    "dailyBudgetUsd": "[operator-controlled limit]"
  },
  "requirements": {
    "task": "Find or review an agent/service candidate from the Virtuals ACP marketplace."
  },
  "status": "draft-prepared-for-review",
  "approvalGate": "operator approval required before live funding or submission"
}
```

## What Is Not Published

- No private API keys.
- No environment variables.
- No private wallet keys or seed phrases.
- No OTPs, magic links, or account recovery material.
- No full private Hatcher user records.
- No claim that the demo funded or settled a live ACP job.

## Reviewer Notes

The demo is intentionally review-first. It proves the Hatcher UI integration, Virtuals provider selection, ACP marketplace search, job-draft preparation, and HatcherLabs service-packaging surface. A later showcase can add live funding and provider delivery proof once the operator decides which HatcherLabs service should be fully published as the first production ACP offering.
