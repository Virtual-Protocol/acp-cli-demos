/**
 * ACP SDK v3 provider skeleton.
 *
 * Real surface (package name still @virtuals-protocol/acp-node-v2):
 *   AcpAgent.create → agent.on("entry") → agent.start()
 *   session.setBudget(AssetToken.usdc(amount, chainId))
 *   session.submit(deliverable)
 *   session.complete / session.reject on the evaluator/client side
 *
 * This file is safe to syntax-check without credentials. Live mode requires
 * a configured provider adapter (Privy/Alchemy) and network access.
 *
 * Run dry map:
 *   node examples/v3-provider.mjs
 *
 * Live (you wire env + adapter):
 *   LIVE=1 node examples/v3-provider.mjs
 */

import { createRequire } from "node:module";

const EVENT_ACTIONS = {
  "job.created": "provider: wait for requirement message, then session.setBudget",
  "budget.set": "client: session.fund",
  "job.funded": "provider: do work, then session.submit(deliverable)",
  "job.submitted": "evaluator/client: session.complete | session.reject",
  "job.completed": "terminal",
  "job.rejected": "terminal",
  "job.expired": "terminal",
};

/** Pure helper — unit-tested by scripts/self-check.mjs */
export function mapEntryToAction(entry) {
  if (!entry || entry.kind !== "system") return { action: "ignore", reason: "non-system entry" };
  const type = entry.event?.type;
  const action = EVENT_ACTIONS[type] ?? "wait";
  return { action, type, detail: EVENT_ACTIONS[type] ?? "unhandled event type" };
}

/** Budget helper mirrors production CLI: AssetToken.usdc(amount, chainId) */
export function budgetPlan(amountUsdc, chainId) {
  if (!(amountUsdc > 0)) throw new Error("amountUsdc must be > 0");
  if (!Number.isInteger(chainId)) throw new Error("chainId must be an integer");
  return {
    call: "session.setBudget(AssetToken.usdc(amountUsdc, chainId))",
    amountUsdc,
    chainId,
    example: `AssetToken.usdc(${amountUsdc}, ${chainId})`,
  };
}

export function buildProviderHandler({
  offeringPriceUsdc,
  chainId,
  deliver,
  live = false,
}) {
  return async function onEntry(session, entry) {
    const mapped = mapEntryToAction(entry);
    if (mapped.action === "ignore") return mapped;

    switch (mapped.type) {
      case "job.created": {
        // Production tip: wait for contentType:"requirement" message before pricing.
        const plan = budgetPlan(offeringPriceUsdc, chainId);
        if (live && session?.setBudget) {
          // Live path only — keeps offline dry-run free of SDK install
          const { AssetToken } = await import("@virtuals-protocol/acp-node-v2");
          await session.setBudget(AssetToken.usdc(offeringPriceUsdc, chainId));
        } else if (session?.setBudget) {
          await session.setBudget(plan.example);
        }
        return { step: "setBudget", plan };
      }
      case "job.funded": {
        const deliverable =
          typeof deliver === "function"
            ? await deliver(session, entry)
            : String(deliver ?? "https://example.com/deliverable");
        if (session?.submit) await session.submit(deliverable);
        return { step: "submit", deliverable };
      }
      default:
        return { step: "noop", mapped };
    }
  };
}

export async function createLiveAgentFromEnv() {
  // Optional live wiring. Kept explicit so demos never hide key handling.
  const { AcpAgent, AssetToken } = await import("@virtuals-protocol/acp-node-v2");
  // Provider construction is environment-specific (PrivyAlchemyEvmProviderAdapter, etc.).
  // See skill SKILL.md "Live wiring" for the full pattern used by acp-cli.
  if (!process.env.ACP_DEMO_PROVIDER_FACTORY) {
    throw new Error(
      "Set ACP_DEMO_PROVIDER_FACTORY to a module that exports createProvider() returning { evmProvider, api, transport }",
    );
  }
  const require = createRequire(import.meta.url);
  const factory = await import(process.env.ACP_DEMO_PROVIDER_FACTORY);
  const parts = await factory.createProvider();
  const agent = await AcpAgent.create(parts);
  return { agent, AssetToken };
}

async function main() {
  const chainId = Number(process.env.CHAIN_ID || 8453);
  const price = Number(process.env.OFFERING_PRICE_USDC || 5);

  const live = process.env.LIVE === "1";
  const handler = buildProviderHandler({
    offeringPriceUsdc: price,
    chainId,
    live,
    deliver: async () =>
      JSON.stringify({
        ok: true,
        note: "replace with real work product",
        ts: new Date().toISOString(),
      }),
  });

  // Dry simulation of the event spine
  const simulated = [
    { kind: "system", event: { type: "job.created" } },
    { kind: "system", event: { type: "job.funded" } },
    { kind: "system", event: { type: "job.submitted" } },
  ];

  const sessionStub = {
    async setBudget(token) {
      console.log("[stub] setBudget", token?.toString?.() ?? token);
    },
    async submit(deliverable) {
      console.log("[stub] submit", deliverable);
    },
  };

  console.log("=== ACP v3 provider dry-run ===");
  for (const entry of simulated) {
    const result = await handler(sessionStub, entry);
    console.log(JSON.stringify({ entry: entry.event.type, result }, null, 2));
  }

  console.log("\nEvent → action map:");
  console.log(JSON.stringify(EVENT_ACTIONS, null, 2));

  if (process.env.LIVE === "1") {
    const { agent } = await createLiveAgentFromEnv();
    agent.on("entry", handler);
    await agent.start();
    console.log("Live agent started. Ctrl+C to stop.");
  }
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
