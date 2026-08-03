// ---------------------------------------------------------------------------
// escrow-nmd.mjs — does ACP escrow accept $NMD as the settlement token on
// Robinhood Chain testnet?
//
// This harness plays the BUYER. It funds a passage job whose budget a
// throwaway provider proposes in $NMD, then asserts the $NMD actually left the
// buyer and entered the ACP escrow. It NEVER embeds a key — everything comes
// from env and it FAILS LOUDLY if anything required is missing.
//
// ── WHAT A HUMAN MUST DO TO RUN THIS ──────────────────────────────────────
//
//  1. Register TWO ACP agents at https://app.virtuals.io/acp/new on Robinhood
//     Chain testnet (chainId 46630): a throwaway PROVIDER and a BUYER. They
//     must be different wallets — ACP forbids self-hire.
//  2. Fund the BUYER wallet with $NMD (0xcB12…0A04) plus a little native ETH
//     for gas. Give the provider a passage offering (region requirement).
//  3. Start the throwaway provider so it can quote the budget in $NMD:
//         npm run provider           # runs src/provider.ts (setBudget in $NMD)
//  4. In another shell, run this harness with the env loaded from your .env
//     (gitignored — never commit real keys). Node 20.6+ reads it natively:
//         node --env-file=.env test/escrow-nmd.mjs
//
//  Required env:
//     BUYER_WALLET_ADDRESS, BUYER_WALLET_ID, BUYER_SIGNER_PRIVATE_KEY
//     SELLER_WALLET_ADDRESS      (the throwaway provider, registered + running)
//  Optional env (sane public defaults):
//     ACP_CHAIN_ID=46630
//     NMD_TOKEN_ADDRESS=0xcB12b7a2E4af30D93a6600FAdaBe27dE143e0A04
//     PASSAGE_PRICE_NMD=1        (only used as a sanity bound)
//     TARGET_REGION=de
//     ESCROW_TIMEOUT_MS=180000
//
// ── FALLBACK if ACP escrow REJECTS custom (non-USDC) tokens ────────────────
//  Some ACP deployments only escrow the canonical stable (USDC). If this
//  harness shows escrow did NOT hold $NMD, the provider-verifies-payment model
//  is the fallback: price the offering in USDC for the on-chain escrow, and
//  require the buyer to settle the passage fee in $NMD out-of-band (a direct
//  $NMD transfer the provider verifies on-chain before provisioning). The
//  passage + signed egress proof are unchanged; only the settlement rail moves.
//  This harness is exactly the probe that tells you which path you're on.
// ---------------------------------------------------------------------------

import {
  AcpAgent,
  PrivyAlchemyEvmProviderAdapter,
  AssetToken,
  robinhoodTestnet,
} from "@virtuals-protocol/acp-node-v2";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`\nFATAL: missing required env ${name}.`);
    console.error("Load your .env (never committed) and retry, e.g.:");
    console.error("  node --env-file=.env test/escrow-nmd.mjs\n");
    process.exit(1);
  }
  return v.trim();
}

const CHAIN_ID = Number(process.env.ACP_CHAIN_ID ?? robinhoodTestnet.id);
const NMD_ADDRESS = (process.env.NMD_TOKEN_ADDRESS ?? "0xcB12b7a2E4af30D93a6600FAdaBe27dE143e0A04").trim();
const NMD_DECIMALS = 18;
const PRICE_BOUND = Number(process.env.PASSAGE_PRICE_NMD ?? "1");
const TARGET_REGION = process.env.TARGET_REGION ?? "de";
const TIMEOUT_MS = Number(process.env.ESCROW_TIMEOUT_MS ?? "180000");

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

async function nmdBalanceOf(adapter, holder) {
  const raw = await adapter.readContract(CHAIN_ID, {
    address: NMD_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [holder],
  });
  return BigInt(raw);
}

function fail(msg) {
  console.error(`\n✗ ESCROW-$NMD TEST FAILED: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const buyerWallet = requireEnv("BUYER_WALLET_ADDRESS");
  const sellerWallet = requireEnv("SELLER_WALLET_ADDRESS");
  const adapter = await PrivyAlchemyEvmProviderAdapter.create({
    walletAddress: requireEnv("BUYER_WALLET_ADDRESS"),
    walletId: requireEnv("BUYER_WALLET_ID"),
    signerPrivateKey: requireEnv("BUYER_SIGNER_PRIVATE_KEY"),
    chains: [robinhoodTestnet],
  });
  const buyer = await AcpAgent.create({ evmProvider: adapter });
  const buyerAddress = await buyer.getAddress();

  console.log("ACP escrow-$NMD acceptance test (Robinhood Chain testnet)");
  console.log(`  chain : ${CHAIN_ID} (${robinhoodTestnet.name})`);
  console.log(`  token : $NMD ${NMD_ADDRESS}`);
  console.log(`  buyer : ${buyerAddress}`);

  // Step 1 — the SDK can represent $NMD as a custom settlement AssetToken.
  const nmd = AssetToken.create(NMD_ADDRESS, "NMD", NMD_DECIMALS, PRICE_BOUND);
  if (!eq(nmd.address, NMD_ADDRESS)) fail(`AssetToken.create dropped the $NMD address (${nmd.address})`);
  if (nmd.decimals !== NMD_DECIMALS) fail(`AssetToken decimals wrong: ${nmd.decimals}`);
  if (nmd.rawAmount <= 0n) fail(`AssetToken rawAmount not positive: ${nmd.rawAmount}`);
  console.log(`✓ AssetToken.create($NMD) → rawAmount=${nmd.rawAmount} (${PRICE_BOUND} NMD)`);

  // Locate the ACP core (escrow) contract for this chain.
  let acpCore;
  try {
    acpCore = buyer.getClient(CHAIN_ID).getContractAddresses()[CHAIN_ID];
  } catch { /* fall through to constant */ }
  if (!acpCore) acpCore = "0x0b93793923CD5De81850aF8604a233f3f24d461e";
  console.log(`  escrow: ACP core ${acpCore}`);

  // Step 2 — point at the throwaway provider and pick its offering.
  const provider = await buyer.getAgentByWalletAddress(sellerWallet);
  if (!provider) fail(`no ACP agent registered at provider wallet ${sellerWallet}`);
  const offering = provider.offerings[0];
  if (!offering) fail(`provider ${sellerWallet} has no offerings — create one at app.virtuals.io/acp/new`);
  console.log(`✓ provider offering "${offering.name}" (sla=${offering.slaMinutes}min)`);

  // Baseline $NMD balances before funding.
  const buyerBefore = await nmdBalanceOf(adapter, buyerAddress);
  const coreBefore = await nmdBalanceOf(adapter, acpCore);
  console.log(`  balances before → buyer=${buyerBefore} escrow=${coreBefore} (raw $NMD)`);
  if (buyerBefore < nmd.rawAmount) {
    fail(`buyer holds ${buyerBefore} raw $NMD, needs >= ${nmd.rawAmount}. Fund the buyer with $NMD first.`);
  }

  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) fail(`timed out after ${TIMEOUT_MS}ms waiting for budget.set/fund. Is the provider running (npm run provider)?`);
  }, TIMEOUT_MS);

  buyer.on("entry", async (session, entry) => {
    if (entry.kind !== "system") return;

    // Step 3 — provider proposed the budget (expected in $NMD). Fund it.
    if (entry.event.type === "budget.set") {
      console.log(`✓ provider proposed budget ${entry.event.amount} $NMD — funding`);
      try {
        await session.fetchJob();
        await session.fund();
      } catch (err) {
        clearTimeout(timer);
        fail(`session.fund() reverted — ACP likely rejected the custom $NMD token: ${err?.message ?? err}`);
      }

      // Step 4 — assert the escrow actually holds $NMD.
      const job = await session.fetchJob();
      const buyerAfter = await nmdBalanceOf(adapter, buyerAddress);
      const coreAfter = await nmdBalanceOf(adapter, acpCore);
      const buyerDelta = buyerBefore - buyerAfter; // should be >= escrowed amount
      const coreDelta = coreAfter - coreBefore;
      console.log(`  balances after  → buyer=${buyerAfter} escrow=${coreAfter} (raw $NMD)`);
      console.log(`  deltas          → buyer -${buyerDelta}  escrow +${coreDelta} (raw $NMD)`);

      // Corroborate via the escrow intent's token address, when present.
      const escrowIntent = (job.intents ?? []).find((i) => i.isEscrow);
      if (escrowIntent) {
        if (!eq(escrowIntent.tokenAddress, NMD_ADDRESS)) {
          clearTimeout(timer);
          fail(`escrow intent settles in ${escrowIntent.tokenAddress}, NOT $NMD (${NMD_ADDRESS}). See FALLBACK in header.`);
        }
        console.log(`✓ escrow intent token = $NMD (${escrowIntent.tokenAddress}), rawAmount=${escrowIntent.rawAmount}`);
      } else {
        console.log("  (no explicit escrow intent record — relying on on-chain $NMD balance movement)");
      }

      settled = true;
      clearTimeout(timer);

      const buyerPaidNmd = buyerDelta >= nmd.rawAmount;
      const escrowGrewNmd = coreDelta > 0n;
      if (buyerPaidNmd && escrowGrewNmd) {
        console.log(`\n✓ PASS — ACP escrow ACCEPTED $NMD: ${coreDelta} raw $NMD now held in escrow (job ${session.jobId}).\n`);
        await buyer.stop();
        process.exit(0);
      }
      fail(
        `$NMD did not land in escrow as expected (buyerPaidNmd=${buyerPaidNmd}, escrowGrewNmd=${escrowGrewNmd}). ` +
        `If the buyer's $NMD did not move, ACP rejected the custom token — use the provider-verifies-payment FALLBACK in the header.`,
      );
    }

    if (entry.event.type === "job.rejected") {
      clearTimeout(timer);
      fail(`provider rejected the job before funding: ${entry.event.reason}`);
    }
    if (entry.event.type === "job.expired") {
      clearTimeout(timer);
      fail("job expired before budget.set — provider not responding");
    }
  });

  await buyer.start();

  // Open the passage job so the provider proposes a $NMD budget.
  const jobId = await buyer.createJobFromOffering(
    CHAIN_ID,
    offering,
    provider.walletAddress,
    { region: TARGET_REGION },
    { evaluatorAddress: buyerAddress },
  );
  console.log(`  opened passage job ${jobId} for region '${TARGET_REGION}' — waiting for $NMD quote…`);
}

main().catch((e) => {
  console.error("\n✗ ESCROW-$NMD TEST ERROR:", e?.message ?? e, "\n");
  process.exit(1);
});
