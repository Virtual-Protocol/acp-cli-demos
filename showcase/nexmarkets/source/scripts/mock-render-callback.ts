import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import { createHmac } from "node:crypto";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  // Find the latest queued or rendering job
  const job = await prisma.renderJob.findFirst({
    where: {
      status: { in: ["QUEUED", "RENDERING"] }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!job) {
    console.log("No pending render jobs found (status QUEUED or RENDERING).");
    process.exit(0);
  }

  console.log(`Found pending render job: ID = ${job.id}, Production ID = ${job.productionId}, Callback ID = ${job.callbackId}`);

  const secret = process.env.HEYGEN_HYPERFRAMES_CALLBACK_SECRET || "dev-secret";
  const body = JSON.stringify({
    callback_id: job.callbackId,
    render_id: job.providerJobId || "render-mock-12345",
    status: "completed",
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=256"
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  console.log("Sending callback webhook request...");
  const response = await fetch("http://localhost:3000/api/v1/webhooks/hyperframes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": `sha256=${signature}`
    },
    body
  });

  const text = await response.text();
  console.log(`Webhook responded with HTTP ${response.status}: ${text}`);
}

run().catch(console.error);
