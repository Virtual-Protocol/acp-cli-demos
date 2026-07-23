import {
  AcpAgent,
  AgentSort,
  PrivyAlchemyEvmProviderAdapter,
  type JobRoomEntry,
  type JobSession,
} from "@virtuals-protocol/acp-node-v2";
import { CHAIN, NMD, PASSAGE_PRICE_NMD, REGION_LABELS } from "./config.js";

// ---------------------------------------------------------------------------
// Sovegent Nomad — BUYER demo (the agent that needs to reach the web from a
// specific region). It buys a scoped, time-boxed *passage* on ACP and pays in
// $NMD on Robinhood Chain.
//
// Buyer lifecycle (matches the acp-node-v2 buyer examples exactly):
//
//   1. discover     → browseAgents("sovereign connectivity") — or a direct
//                     getAgentByWalletAddress(NOMAD_PROVIDER_ADDRESS) lookup.
//   2. request      → createJobFromOffering() with { region, byoWireguardEndpoint? }.
//                     The requirement is what makes this provider-agnostic:
//                       • omit byoWireguardEndpoint → the MANAGED reference exit
//                       • pass your own WireGuard endpoint → BYO exit
//                         (Mullvad / Proton / self-hosted). Nomad only
//                         orchestrates + attests; your pipes stay yours.
//   3. budget.set   → the provider proposes the $NMD fee. We check it against a
//                     cap, then session.fetchJob() + session.fund() escrows $NMD.
//   4. job.submitted→ deliverable = { passage, proof }. We VERIFY the signed
//                     egress proof's region matches what we asked for, then
//                     session.complete() (escrow releases) or session.reject().
//   5. job.completed→ passage is live; print it and stop.
//   6. job.rejected / job.expired → log and stop.
//
// NOTE on the ACP budget model: in ACP the *provider* proposes the budget
// (setBudget) and the *buyer* funds it (fund). So "set budget + fund in $NMD"
// from the buyer's side means: confirm the proposed budget is the expected
// $NMD amount, then fund it. There is no hardcoded price here — the provider
// quotes it and we gate on our own cap.
//
// All secrets come from env (see .env.example). Nothing is hardcoded.
// ---------------------------------------------------------------------------

/** Region the agent wants to egress from, e.g. "de", "us-ca", "ch". */
const TARGET_REGION = process.env.TARGET_REGION ?? "de";

/** Optional: bring-your-own WireGuard exit endpoint. When set, the provider
 *  attests over YOUR exit instead of provisioning a managed one. Never commit it. */
const BYO_WIREGUARD_ENDPOINT = process.env.BYO_WIREGUARD_ENDPOINT;

/** Refuse to fund a passage that quotes above this many $NMD (buyer policy). */
const MAX_PASSAGE_NMD = Number(process.env.MAX_PASSAGE_NMD ?? String(PASSAGE_PRICE_NMD * 2));

/** Keyword used to discover the Nomad provider in the ACP registry. */
const DISCOVERY_KEYWORD = process.env.NOMAD_DISCOVERY_KEYWORD ?? "sovereign connectivity";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing required env ${key} — see .env.example`);
  return v;
}

const shortAddr = (a: string): string =>
  !a || !a.startsWith("0x") || a.length < 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Requested region per job, so we can verify the egress proof on delivery. */
const requestedRegion = new Map<string, string>();

interface EgressProof {
  region: string;
  seenAs?: { ip: string; city: string; country: string };
  issuedAt?: number;
  signature?: string;
}
interface Passage {
  region: string;
  label: string;
  endpoint: string;
  expiresAt: number;
}

/** Verify the delivered proof actually egresses from the region we paid for. */
function verifyEgress(want: string, passage: Passage, proof: EgressProof): boolean {
  if (proof.region !== want) return false;
  if (passage.region !== want) return false;
  // In production, also verify `proof.signature` against Nomad's published
  // attestation public key here before trusting `proof.seenAs`.
  return true;
}

async function main(): Promise<void> {
  const buyer = await AcpAgent.create({
    evmProvider: await PrivyAlchemyEvmProviderAdapter.create({
      walletAddress: requireEnv("BUYER_WALLET_ADDRESS") as `0x${string}`,
      walletId: requireEnv("BUYER_WALLET_ID"),
      signerPrivateKey: requireEnv("BUYER_SIGNER_PRIVATE_KEY"),
      chains: [CHAIN], // Robinhood Chain testnet (46630)
    }),
  });

  const buyerAddress = await buyer.getAddress();
  const buyerAddressLower = buyerAddress.toLowerCase();

  console.log("Sovegent Nomad — buying a sovereign passage (ACP buyer)");
  console.log(`  chain   : ${CHAIN.id} (${CHAIN.name})`);
  console.log(`  token   : $NMD ${NMD.address}`);
  console.log(`  region  : ${TARGET_REGION} (${REGION_LABELS[TARGET_REGION] ?? TARGET_REGION})`);
  console.log(`  exit    : ${BYO_WIREGUARD_ENDPOINT ? "BYO WireGuard" : "managed reference exit"}`);
  console.log(`  wallet  : ${buyerAddress}`);

  buyer.on("entry", async (session: JobSession, entry: JobRoomEntry) => {
    if (entry.kind === "message" && entry.from.toLowerCase() !== buyerAddressLower) {
      console.log(`[job ${session.jobId}] provider ${shortAddr(entry.from)}: ${entry.content}`);
    }

    if (entry.kind !== "system") return;

    switch (entry.event.type) {
      // Provider quoted the passage fee (in $NMD). Gate on our cap, then fund.
      case "budget.set": {
        const quoted = entry.event.amount;
        console.log(`[job ${session.jobId}] quoted ${quoted} $NMD for passage to ${TARGET_REGION}`);
        if (quoted > MAX_PASSAGE_NMD) {
          await session.sendMessage(`Quote ${quoted} $NMD exceeds cap ${MAX_PASSAGE_NMD} $NMD`);
          await session.reject("passage over budget cap");
          return;
        }
        try {
          await session.sendMessage("Quote accepted — funding the passage in $NMD.");
          await session.fetchJob(); // load the off-chain job before funding
          await session.fund(); // escrows the provider-proposed $NMD budget
          console.log(`[job ${session.jobId}] funded ${quoted} $NMD — escrow held`);
        } catch (err) {
          console.error(`[job ${session.jobId}] funding failed:`, err);
        }
        break;
      }

      // Provider delivered { passage, proof }. Verify egress BEFORE releasing.
      case "job.submitted": {
        const want = requestedRegion.get(String(session.jobId)) ?? TARGET_REGION;
        let passage: Passage | undefined;
        let proof: EgressProof | undefined;
        try {
          const parsed = JSON.parse(entry.event.deliverable);
          passage = parsed.passage;
          proof = parsed.proof;
        } catch {
          await session.reject("deliverable was not valid passage+proof JSON");
          return;
        }

        if (!passage || !proof || !verifyEgress(want, passage, proof)) {
          console.error(`[job ${session.jobId}] egress proof did NOT match region '${want}' — rejecting`);
          await session.sendMessage(`Egress proof does not attest region '${want}'`);
          await session.reject("egress region mismatch");
          return;
        }

        console.log(`[job ${session.jobId}] verified egress from ${passage.label} — releasing escrow`);
        console.log(`[job ${session.jobId}]   endpoint  : ${passage.endpoint}`);
        console.log(`[job ${session.jobId}]   expires   : ${new Date(passage.expiresAt * 1000).toISOString()}`);
        console.log(`[job ${session.jobId}]   proof     : ${JSON.stringify(proof.seenAs ?? {})}`);
        try {
          await session.complete("Egress verified against requested region");
        } catch (err) {
          console.error(`[job ${session.jobId}] completion failed:`, err);
        }
        break;
      }

      case "job.completed":
        console.log(`✓ job ${session.jobId} completed — passage live, $NMD released.`);
        await buyer.stop();
        break;

      case "job.rejected":
        console.log(`✗ job ${session.jobId} rejected: ${entry.event.reason}`);
        await buyer.stop();
        break;

      case "job.expired":
        console.log(`✗ job ${session.jobId} expired before delivery`);
        await buyer.stop();
        break;
    }
  });

  await buyer.start();

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`received ${signal}, shutting down`);
    await buyer.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // 1. Discover the Nomad provider. Prefer registry discovery by keyword; fall
  //    back to a direct wallet lookup when NOMAD_PROVIDER_ADDRESS is set.
  let provider = null;
  const directAddress = process.env.NOMAD_PROVIDER_ADDRESS;
  if (directAddress) {
    console.log(`looking up Nomad provider at ${directAddress}`);
    provider = await buyer.getAgentByWalletAddress(directAddress);
  } else {
    console.log(`discovering Nomad provider by keyword "${DISCOVERY_KEYWORD}"`);
    const found = await buyer.browseAgents(DISCOVERY_KEYWORD, {
      sortBy: [AgentSort.SUCCESSFUL_JOB_COUNT, AgentSort.SUCCESS_RATE],
      topK: 5,
      showHidden: true,
    });
    provider = found[0] ?? null;
  }
  if (!provider) {
    console.error("no Nomad provider found — set NOMAD_PROVIDER_ADDRESS or register the provider first");
    await buyer.stop();
    return;
  }
  console.log(`found provider ${shortAddr(provider.walletAddress)} with ${provider.offerings.length} offering(s)`);

  // 2. Pick the connectivity offering.
  const offering = provider.offerings[0];
  if (!offering) {
    console.error("provider has no offerings");
    await buyer.stop();
    return;
  }
  console.log(`selected offering "${offering.name}" (sla=${offering.slaMinutes}min)`);

  // 3. Open the passage job. The requirement is provider-agnostic: pass a BYO
  //    WireGuard endpoint to attest over YOUR exit, or omit it for the managed one.
  const requirementData: Record<string, unknown> = { region: TARGET_REGION };
  if (BYO_WIREGUARD_ENDPOINT) requirementData.byoWireguardEndpoint = BYO_WIREGUARD_ENDPOINT;
  console.log(`requirement: ${JSON.stringify(requirementData)}`);

  try {
    // evaluatorAddress: buyerAddress → self-evaluation: this buyer verifies the
    // egress proof itself before completing (see the job.submitted branch).
    const jobId = await buyer.createJobFromOffering(
      CHAIN.id,
      offering,
      provider.walletAddress,
      requirementData,
      { evaluatorAddress: buyerAddress },
    );
    requestedRegion.set(String(jobId), TARGET_REGION);
    console.log(`[job ${jobId}] passage requested — waiting for the provider's $NMD quote`);
  } catch (err) {
    console.error("createJobFromOffering failed:", err);
    await buyer.stop();
  }
}

main().catch((e) => {
  console.error("buyer error:", e);
  process.exit(1);
});
