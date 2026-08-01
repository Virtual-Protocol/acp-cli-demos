/**
 * Canonical v2 phase → v3 event mapping (from Virtuals ACP SDK migration guide).
 */

export const PHASE_TO_EVENT = [
  { v2Phase: "REQUEST", v3Event: "job.created", nextActor: "Provider" },
  { v2Phase: "NEGOTIATION", v3Event: "budget.set", nextActor: "Client" },
  { v2Phase: "TRANSACTION", v3Event: "job.funded", nextActor: "Provider" },
  { v2Phase: "EVALUATION", v3Event: "job.submitted", nextActor: "Evaluator / Client" },
  { v2Phase: "COMPLETED", v3Event: "job.completed", nextActor: "—" },
  { v2Phase: "REJECTED", v3Event: "job.rejected", nextActor: "—" },
];

export const ACTION_TABLE = [
  { action: "Propose price", v2: "job.accept() + job.createRequirement()", v3: "session.setBudget(AssetToken.usdc(amount, chainId))" },
  { action: "Pay / fund", v2: "job.payAndAcceptRequirement()", v3: "session.fund(AssetToken.usdc(amount, chainId))" },
  { action: "Submit deliverable", v2: "job.deliver({ type, value })", v3: "session.submit(deliverable)" },
  { action: "Approve", v2: 'job.evaluate(true, "reason")', v3: 'session.complete("reason")' },
  { action: "Reject", v2: "job.evaluate(false)", v3: 'session.reject("reason")' },
];

export const INIT_TABLE = [
  { concern: "Construct agent", v2: "new AcpClient({ acpContractClient, onNewTask, onEvaluate })", v3: "await AcpAgent.create({ provider / evmProvider, ... }); agent.on('entry', handler); await agent.start()" },
  { concern: "Contract client", v2: "AcpContractClientV2.build(PRIVATE_KEY, ENTITY_ID, WALLET, config)", v3: "Provider adapters (Privy/Alchemy) — keys not held in app memory at rest" },
  { concern: "Tokens", v2: "Fare / FareAmount", v3: "AssetToken.usdc(amount, chainId)" },
  { concern: "Create job", v2: "offering.initiateJob(req, evaluator)", v3: "agent.createJobFromOffering(chainId, offering, provider, req, { evaluatorAddress })" },
  { concern: "Lifecycle control", v2: "acpClient.init()", v3: "agent.start() / agent.stop()" },
];

export function lookupPhase(v2Phase) {
  const row = PHASE_TO_EVENT.find((r) => r.v2Phase === String(v2Phase).toUpperCase());
  if (!row) throw new Error(`Unknown v2 phase: ${v2Phase}`);
  return row;
}

async function main() {
  console.log(JSON.stringify({ PHASE_TO_EVENT, ACTION_TABLE, INIT_TABLE }, null, 2));
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
