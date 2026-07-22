import "dotenv/config";
import { getPrisma } from "../src/lib/db";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  const productions = await prisma.production.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });

  console.log("--- RECENT PRODUCTIONS ---");
  for (const p of productions) {
    console.log(`ID: ${p.id}, Title: ${p.title}, Kind: ${p.kind}, Status: ${p.status}, CreatedAt: ${p.createdAt}`);
  }

  const renderJobs = await prisma.renderJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });

  console.log("\n--- RECENT RENDER JOBS ---");
  for (const r of renderJobs) {
    console.log(`ID: ${r.id}, ProductionID: ${r.productionId}, Status: ${r.status}, CreatedAt: ${r.createdAt}`);
  }
}

run().catch(console.error);
