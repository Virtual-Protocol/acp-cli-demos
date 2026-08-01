/**
 * ACP SDK v3 client skeleton.
 *
 * Replaces:
 *   offering.initiateJob(requirement, EVALUATOR_ADDRESS)
 * with:
 *   agent.createJobFromOffering(chainId, offering, providerAddress, requirement, { evaluatorAddress })
 *
 * Funding:
 *   session.fund(AssetToken.usdc(amount, chainId))
 * Evaluation:
 *   session.complete(reason) | session.reject(reason)
 */

export const clientMigration = {
  createJob: {
    v2: "offering.initiateJob({ requirement }, EVALUATOR_ADDRESS)",
    v3: "agent.createJobFromOffering(chainId, offering, providerAddress, requirement, { evaluatorAddress })",
  },
  fund: {
    v2: "job.payAndAcceptRequirement()",
    v3: "session.fund(AssetToken.usdc(amount, chainId))",
  },
  evaluate: {
    v2: "job.evaluate(true|false, reason?)",
    v3: {
      approve: "session.complete(reason)",
      reject: "session.reject(reason)",
    },
  },
};

export function assertExactFundAmount(eventAmount, fundAmount) {
  // Production rule from acp-cli: fund amount must match budget.set exactly.
  const a = Number(eventAmount);
  const b = Number(fundAmount);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("fund amounts must be finite numbers");
  }
  if (a !== b) {
    throw new Error(`fund amount ${b} must exactly equal budget event amount ${a}`);
  }
  return true;
}

export function buildClientHandler({ autoComplete = false } = {}) {
  return async function onEntry(session, entry) {
    if (!entry || entry.kind !== "system") return { action: "ignore" };
    const type = entry.event?.type;

    if (type === "budget.set") {
      const amount = entry.event.amount;
      return {
        action: "fund",
        amount,
        call: `session.fund(AssetToken.usdc(${amount}, session.chainId))`,
        rule: "amount must match event exactly",
      };
    }

    if (type === "job.submitted") {
      const deliverable = entry.event?.deliverable;
      if (autoComplete && session?.complete) {
        await session.complete("Approved by demo client");
        return { action: "complete", deliverable };
      }
      return {
        action: "review",
        deliverable,
        approve: "session.complete(reason)",
        reject: "session.reject(reason)",
      };
    }

    return { action: "wait", type };
  };
}

async function main() {
  console.log("=== ACP v3 client migration map ===");
  console.log(JSON.stringify(clientMigration, null, 2));

  const handler = buildClientHandler({ autoComplete: false });
  const samples = [
    { kind: "system", event: { type: "budget.set", amount: 0.11 } },
    { kind: "system", event: { type: "job.submitted", deliverable: "https://example.com/out" } },
  ];
  for (const entry of samples) {
    const result = await handler(
      {
        chainId: 8453,
        async complete(reason) {
          console.log("complete", reason);
        },
      },
      entry,
    );
    console.log(JSON.stringify({ entry: entry.event.type, result }, null, 2));
  }

  // Demonstrate exact-amount guard
  assertExactFundAmount(0.11, 0.11);
  console.log("exact fund guard: ok");
}

const isDirect =
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file://").href;

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
