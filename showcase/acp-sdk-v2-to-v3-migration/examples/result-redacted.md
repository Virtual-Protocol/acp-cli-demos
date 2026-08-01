# Redacted result

## What ran

```bash
node showcase/acp-sdk-v2-to-v3-migration/scripts/self-check.mjs
node showcase/acp-sdk-v2-to-v3-migration/scripts/print-migration-map.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-provider.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-client.mjs
node scripts/validate-showcase.mjs
```

## Outcome (redacted)

- Offline self-check: **PASS** (all helper assertions green)
- Provider dry-run: emitted `setBudget` plan for `job.created` and `submit` for `job.funded`
- Client dry-run: emitted exact-amount `fund` instruction on `budget.set` and review actions on `job.submitted`
- Showcase validator: **PASS** for slug `acp-sdk-v2-to-v3-migration`
- Secrets printed: **none**
- On-chain txs: **none** (offline by design)

## Migration deltas demonstrated

| Before | After |
| --- | --- |
| `onNewTask` / `onEvaluate` | `agent.on("entry", ...)` |
| `AcpJobPhases.*` | `entry.event.type` strings |
| `FareAmount` | `AssetToken.usdc(amount, chainId)` |
| `job.deliver` / `job.evaluate` | `session.submit` / `session.complete` |
| `offering.initiateJob` | `agent.createJobFromOffering` |
