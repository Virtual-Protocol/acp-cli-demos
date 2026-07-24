import {
  AcpAgent,
  AssetToken,
  PrivyAlchemyEvmProviderAdapter,
  type JobRoomEntry,
  type JobSession,
} from "@virtuals-protocol/acp-node-v2";
import { CHAIN, NMD, PASSAGE_PRICE_NMD, offeredRegions } from "./config.js";
import { provisionPassage } from "./broker.js";
import { attestEgress } from "./proof.js";

const PASSAGE_TTL_SECONDS = 3600; // scoped passage lifetime

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing required env ${key} — see .env.example`);
  return v;
}

/**
 * The $NMD budget for a passage. ACP defaults to USDC; we override with the custom $NMD ERC-20
 * on Robinhood Chain via AssetToken.create. NOTE: the exact amount-binding for a custom token is
 * confirmed against the SDK during the Robinhood-testnet escrow test before go-live.
 */
function nmdBudget() {
  return AssetToken.create(
    NMD.address as `0x${string}`,
    NMD.symbol,
    NMD.decimals,
    PASSAGE_PRICE_NMD,
  );
}

/** What the buyer asked for, remembered per job so we can honor it on funding.
 *  In ACP the requirement arrives as a "requirement" message (JSON) BEFORE the
 *  buyer funds — we capture it there and read it back when job.funded fires. */
interface RequestedPassage {
  region: string;
  byo: string | undefined; // optional: buyer's own Mullvad/Proton/self-hosted exit
}
const requested = new Map<string, RequestedPassage>();

async function main() {
  const provider = await PrivyAlchemyEvmProviderAdapter.create({
    walletAddress: requireEnv("SELLER_WALLET_ADDRESS") as `0x${string}`,
    walletId: requireEnv("SELLER_WALLET_ID"),
    signerPrivateKey: requireEnv("SELLER_SIGNER_PRIVATE_KEY"),
    chains: [CHAIN], // Robinhood Chain testnet (46630)
  });

  const seller = await AcpAgent.create({ evmProvider: provider });

  console.log("Sovegent Nomad — Sovereign Connectivity (ACP provider)");
  console.log(`  chain   : ${CHAIN.id} (${CHAIN.name})`);
  console.log(`  token   : $NMD ${NMD.address}`);
  console.log(`  regions : ${offeredRegions().map((r) => `${r.region} (${r.label})`).join(", ")}`);
  console.log(`  price   : ${PASSAGE_PRICE_NMD} $NMD / passage`);

  seller.on("entry", async (session: JobSession, entry: JobRoomEntry) => {
    // 1. Buyer's requirement lands first (region + optional BYO exit). We record
    //    what they asked for, then quote the passage fee in $NMD via setBudget.
    //    Guard on status === "open" so replayed/duplicate entries don't re-quote.
    if (
      entry.kind === "message" &&
      entry.contentType === "requirement" &&
      session.status === "open"
    ) {
      let region = offeredRegions()[0]?.region ?? "de";
      let byo: string | undefined;
      try {
        const req = JSON.parse(entry.content) as {
          region?: unknown;
          byoWireguardEndpoint?: unknown;
        };
        if (req.region != null) region = String(req.region);
        if (typeof req.byoWireguardEndpoint === "string") byo = req.byoWireguardEndpoint;
      } catch {
        // malformed requirement — fall back to the default region below
      }
      requested.set(session.jobId, { region, byo });

      await session.setBudget(nmdBudget());
      console.log(`[job ${session.jobId}] quoted ${PASSAGE_PRICE_NMD} $NMD for passage to ${region}`);
      return;
    }

    if (entry.kind !== "system") return;

    switch (entry.event.type) {
      // 2. Buyer funded escrow → provision the passage and deliver it with a signed egress proof.
      case "job.funded": {
        const req = requested.get(session.jobId);
        const region = req?.region ?? offeredRegions()[0]?.region ?? "de";
        const byo = req?.byo; // optional: buyer's own Mullvad/Proton/self-hosted exit

        const passage = await provisionPassage(region, PASSAGE_TTL_SECONDS, byo);
        const proof = await attestEgress(passage);

        await session.submit(JSON.stringify({ passage, proof }));
        console.log(`→ delivered passage to ${passage.label} (job ${session.jobId})`);
        return;
      }

      // 3. Escrow released.
      case "job.completed":
        console.log(`✓ job ${session.jobId} completed — $NMD released.`);
        return;
    }
  });

  await seller.start();
  console.log("provider live — waiting for connectivity jobs…");
}

main().catch((e) => {
  console.error("provider error:", e);
  process.exit(1);
});
