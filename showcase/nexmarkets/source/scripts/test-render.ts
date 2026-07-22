import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import { submitHyperFramesRender } from "../src/hyperframes/render-service";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  const id = "f1c00b27-102c-4cdc-a3a4-8352d8069f0a";
  const p = await prisma.production.findUnique({ where: { id } });
  if (!p) {
    console.error("Production not found");
    process.exit(1);
  }

  console.log("Submitting render for production:", p.id);

  try {
    const result = await submitHyperFramesRender(
      {
        productionId: id,
        title: p.title,
        message: "https://nexmarkets.xyz",
        callToAction: "Learn more",
        accent: typeof record(p.direction).primaryColour === "string" ? record(p.direction).primaryColour as string : "#ffb000",
        aspectRatio: "16:9",
        durationSeconds: 30,
        assets: []
      },
      "test-idempotency-key"
    );
    console.log("Success! Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("SUBMIT ERROR:", error);
  }
}

run().catch(console.error);
