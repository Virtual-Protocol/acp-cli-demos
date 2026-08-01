/**
 * LEGACY (ACP SDK v2 shape) — educational only.
 *
 * This file shows the old two-callback provider model:
 *   - AcpContractClientV2.build(...)
 *   - new AcpClient({ onNewTask, onEvaluate })
 *   - job phase switches + memo signing
 *   - Fare / FareAmount
 *
 * Do NOT run this against current packages. The symbols are intentionally
 * left as comments / pseudo-imports so the file stays readable without
 * installing the retired API surface.
 *
 * Migrate to: examples/v3-provider.mjs
 */

// Pseudo-import (retired API):
// import { AcpClient, AcpContractClientV2, AcpJobPhases, Fare, FareAmount } from "@virtuals-protocol/acp-node-v2";

export const legacyProviderShape = {
  init: {
    client: "new AcpClient({ acpContractClient, onNewTask, onEvaluate })",
    contractClient: "await AcpContractClientV2.build(PRIVATE_KEY, ENTITY_ID, AGENT_WALLET, baseAcpX402ConfigV2)",
  },
  callbacks: {
    onNewTask: [
      "if (job.phase === REQUEST) await job.accept(reason)",
      "if (job.phase === REQUEST) await job.createRequirement(...)",
      "if (job.phase === TRANSACTION) await job.deliver({ type, value })",
    ],
    onEvaluate: [
      "await job.evaluate(true, reason)  // approve",
      "await job.evaluate(false)         // reject",
    ],
  },
  tokens: {
    before: "new FareAmount(Fare.USDC, amount)",
    note: "Fare / FareAmount removed in v3",
  },
  problems: [
    "Private key held in application memory at rest",
    "Single-chain session model",
    "Phase enums + memo signing instead of hook contracts",
    "Split callbacks force re-hydrating job context twice",
  ],
};

// Illustrative pseudo-handler (not executable against current SDK):
export async function legacyOnNewTaskPseudo(job /*, memoToSign */) {
  // switch (job.phase) {
  //   case AcpJobPhases.REQUEST:
  //     await job.accept("Accepted");
  //     await job.createRequirement("Need brief");
  //     break;
  //   case AcpJobPhases.TRANSACTION:
  //     await job.deliver({ type: "url", value: "https://example.com/out" });
  //     break;
  // }
  return {
    jobId: job?.id ?? null,
    migratedTo: "agent.on('entry') + session.setBudget/submit",
  };
}

export async function legacyOnEvaluatePseudo(job) {
  // await job.evaluate(true, "Approved");
  return {
    jobId: job?.id ?? null,
    migratedTo: "session.complete(reason) | session.reject(reason)",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ legacyProviderShape }, null, 2));
}
