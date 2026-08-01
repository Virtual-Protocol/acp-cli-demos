# Offline validation receipt

**Project:** acp-sdk-v2-to-v3-migration  
**Mode:** offline / no credentials / no network calls to ACP  
**Date:** 2026-08-01  

## Commands

```bash
node showcase/acp-sdk-v2-to-v3-migration/scripts/self-check.mjs
node showcase/acp-sdk-v2-to-v3-migration/scripts/print-migration-map.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-provider.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-client.mjs
node --check showcase/acp-sdk-v2-to-v3-migration/examples/v3-provider.mjs
node --check showcase/acp-sdk-v2-to-v3-migration/examples/v3-client.mjs
node --check showcase/acp-sdk-v2-to-v3-migration/examples/phase-event-map.mjs
node scripts/validate-showcase.mjs
```

## Expected self-check gates

1. REQUEST maps to `job.created`
2. EVALUATION maps to `job.submitted`
3. Six lifecycle rows present
4. `mapEntryToAction` routes `job.funded` toward submit
5. Non-system entries ignored
6. `budgetPlan` rejects non-positive amounts
7. Provider handler returns setBudget plan + submit deliverable
8. Exact fund amount guard enforces equality
9. Client handler returns fund instruction on `budget.set`
10. Legacy shape still documents retired callbacks

## Redaction

- No private keys
- No wallet seed phrases
- No API tokens
- No signer approval URLs
- No customer job payloads

## Claim boundary

This proof validates **migration helper correctness and showcase packaging**.
It does **not** claim a live mainnet job round-trip. Live verification is
intentionally out of band and requires a human-approved provider adapter.

## Public PR

https://github.com/Virtual-Protocol/acp-cli-demos/pull/94
