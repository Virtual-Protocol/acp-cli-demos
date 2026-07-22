import "dotenv/config";
import { getPrisma } from "../src/lib/db";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  // Find the latest video production
  const p = await prisma.production.findFirst({
    where: { kind: "VIDEO" },
    orderBy: { createdAt: "desc" }
  });

  if (!p) {
    console.error("No video production found in database.");
    process.exit(1);
  }

  console.log(`Transitioning production ${p.id} from ${p.status} to BRIEF_REVIEW...`);

  await prisma.production.update({
    where: { id: p.id },
    data: {
      status: "BRIEF_REVIEW",
      priceAtomic: 5000000n, // 5 USDC
      payerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" // mock dev wallet
    }
  });

  console.log("Success! Refresh your Studio page in the browser.");
}

run().catch(console.error);
