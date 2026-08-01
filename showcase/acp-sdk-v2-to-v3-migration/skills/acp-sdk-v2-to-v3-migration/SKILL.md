---
name: acp-sdk-v2-to-v3-migration
description: Migrate an ACP Node integration from the v2 AcpClient two-callback model to the v3 AcpAgent entry-event model (package name remains @virtuals-protocol/acp-node-v2).
version: 1.0.0
---

# ACP SDK v2 → v3 Migration

## When to use

- You still construct `new AcpClient({ onNewTask, onEvaluate })`
- You still call `AcpContractClientV2.build(...)` with a raw private key
- You still use `Fare` / `FareAmount`, `job.accept`, `job.deliver`, `job.evaluate`, or `offering.initiateJob`
- You need a side-by-side map of phases → events and a dry-runnable provider/client skeleton

## When NOT to use

- You already run `AcpAgent.create` + `agent.on("entry")` (you are on v3)
- You only use `acp-cli` with no custom Node SDK code (CLI is already on the v3 surface)
- You need wallet funding, email, or card checkout — use those dedicated skills instead

## Required inputs

- Node 20.19+
- Existing ACP v2 integration source (or willingness to start from the skeletons in `examples/`)
- For live tests only: provider adapter credentials (Privy/Alchemy) and an EconomyOS agent

## Preconditions

1. Platform: open **My Agents & Projects** on the Virtuals dashboard and click **Upgrade now** on the migration banner if the agent is still legacy.
2. Dependencies (package name unchanged):

```bash
npm install @virtuals-protocol/acp-node-v2 viem @account-kit/infra @account-kit/smart-contracts @aa-sdk/core
```

3. Offline check of this package:

```bash
node showcase/acp-sdk-v2-to-v3-migration/scripts/self-check.mjs
node showcase/acp-sdk-v2-to-v3-migration/scripts/print-migration-map.mjs
```

## Migration steps

### 1. Replace initialization

**Before**

```js
const acpClient = new AcpClient({
  acpContractClient: await AcpContractClientV2.build(
    PRIVATE_KEY, ENTITY_ID, AGENT_WALLET_ADDRESS, baseAcpX402ConfigV2
  ),
  onNewTask: async (job, memoToSign) => { /* ... */ },
  onEvaluate: async (job) => { /* ... */ },
});
```

**After**

```js
import { AcpAgent } from "@virtuals-protocol/acp-node-v2";

const agent = await AcpAgent.create({
  // Prefer provider adapters (Privy/Alchemy) so keys are not held in app memory at rest.
  evmProvider, // or `provider` depending on SDK minor version
  // api / transport optional when defaults apply
});
agent.on("entry", async (session, entry) => { /* ... */ });
await agent.start();
// later: await agent.stop();
```

### 2. Replace event handling

| v2 | v3 |
| --- | --- |
| `onNewTask` + `onEvaluate` | single `agent.on("entry", handler)` |
| `AcpJobPhases.REQUEST` | `entry.event.type === "job.created"` |
| `AcpJobPhases.NEGOTIATION` | `budget.set` |
| `AcpJobPhases.TRANSACTION` | `job.funded` |
| `AcpJobPhases.EVALUATION` | `job.submitted` |
| `COMPLETED` / `REJECTED` | `job.completed` / `job.rejected` |

Provider spine:

```js
agent.on("entry", async (session, entry) => {
  if (entry.kind !== "system") return;
  switch (entry.event.type) {
    case "job.created":
      await session.setBudget(AssetToken.usdc(price, session.chainId));
      break;
    case "job.funded":
      await session.submit("https://example.com/deliverable");
      break;
  }
});
```

Client/evaluator spine:

```js
agent.on("entry", async (session, entry) => {
  if (entry.kind !== "system") return;
  switch (entry.event.type) {
    case "budget.set":
      await session.fund(AssetToken.usdc(entry.event.amount, session.chainId));
      break;
    case "job.submitted":
      await session.complete("Approved");
      // or: await session.reject("Reason");
      break;
  }
});
```

### 3. Replace job actions

| Action | v2 | v3 |
| --- | --- | --- |
| Propose price | `job.accept()` + `job.createRequirement()` | `session.setBudget(AssetToken.usdc(amount, chainId))` |
| Pay / fund | `job.payAndAcceptRequirement()` | `session.fund(AssetToken.usdc(amount, chainId))` |
| Submit deliverable | `job.deliver({ type, value })` | `session.submit(deliverable)` |
| Approve | `job.evaluate(true, reason)` | `session.complete(reason)` |
| Reject | `job.evaluate(false)` | `session.reject(reason)` |

### 4. Replace token helpers

```js
// Before
import { Fare, FareAmount } from "@virtuals-protocol/acp-node-v2";

// After
import { AssetToken } from "@virtuals-protocol/acp-node-v2";
AssetToken.usdc(0.1, chainId);
```

### 5. Replace job creation

```js
// Before
const jobId = await offering.initiateJob({ requirement: "..." }, EVALUATOR_ADDRESS);

// After
const jobId = await agent.createJobFromOffering(
  chainId,
  offering,
  providerAddress,
  { requirement: "..." },
  { evaluatorAddress: await agent.getAddress() },
);
```

## Approval gates

- **Dashboard Upgrade now** — human clicks migration banner (irreversible agent metadata path)
- **Signer approval** — human approves P256 signer URL from `acp agent add-signer` when using CLI
- **Funding** — never auto-fund wallets; ask the human for method + amount
- **LIVE=1 demos** — only after credentials and chain ID are explicit

## Stop conditions

- Stop if the codebase already uses `AcpAgent.create` (no-op migration)
- Stop if `acp agent migrate` returns `No legacy agents to migrate` and no app code references `onNewTask`
- Stop before mainnet value transfer if dry-run/self-check failed
- Stop if fund amount would not exactly equal `budget.set` event amount

## Validation

```bash
# From repo root
node showcase/acp-sdk-v2-to-v3-migration/scripts/self-check.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-provider.mjs
node showcase/acp-sdk-v2-to-v3-migration/examples/v3-client.mjs
node scripts/validate-showcase.mjs
```

Grep gates on the migrated app:

```bash
# Should be empty after migration
rg -n "onNewTask|onEvaluate|AcpContractClientV2|FareAmount|initiateJob\\(|AcpJobPhases" src/

# Should hit
rg -n "AcpAgent\\.create|agent\\.on\\([\\\"']entry|AssetToken\\.usdc|createJobFromOffering|session\\.setBudget" src/
```

## Output contract

- Updated init to `AcpAgent.create` + `start`/`stop`
- Single `entry` handler with event-type switches
- All money paths go through `AssetToken.usdc`
- Provider/client actions use `session.*` methods
- Redacted proof note listing what changed and what was verified offline

## Reference files in this package

- `examples/v2-provider.legacy.mjs` — retired shape (documentation)
- `examples/v3-provider.mjs` — provider skeleton + dry-run
- `examples/v3-client.mjs` — client skeleton + exact fund guard
- `examples/phase-event-map.mjs` — canonical tables
- `proof/offline-validation.md` — redacted self-check receipt
- `examples/prompt.md` / `examples/result-redacted.md` — operator prompt + result

## Live wiring note

Production agents (including `acp-cli`) build providers roughly like:

```js
import {
  AcpAgent,
  PrivyAlchemyEvmProviderAdapter,
  AcpApiClient,
  SseTransport,
  ACP_CONTRACT_ADDRESSES,
} from "@virtuals-protocol/acp-node-v2";

const agent = await AcpAgent.create({
  contractAddresses: ACP_CONTRACT_ADDRESSES,
  evmProvider: await PrivyAlchemyEvmProviderAdapter.create({ /* walletId, signFn, chains */ }),
  api: new AcpApiClient({ serverUrl }),
  transport: new SseTransport({ serverUrl }),
});
```

Exact adapter constructor options change across minors — copy from the installed package's types (`dist/acpAgent.d.ts`, `dist/providers/**`) rather than hard-coding secrets into the skill.
