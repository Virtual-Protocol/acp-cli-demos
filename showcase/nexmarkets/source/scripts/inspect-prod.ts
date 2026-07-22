import "dotenv/config";
import { getPrisma } from "../src/lib/db";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  const p = await prisma.production.findUnique({
    where: { id: "f1c00b27-102c-4cdc-a3a4-8352d8069f0a" }
  });

  console.log(JSON.stringify(p, null, 2));
}

run().catch(console.error);
