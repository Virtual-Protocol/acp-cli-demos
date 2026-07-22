import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import { HeyGenHyperFramesClient } from "../src/hyperframes/heygen";
import { createHmac } from "node:crypto";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  // Find the latest pending render job
  const job = await prisma.renderJob.findFirst({
    where: {
      status: { in: ["QUEUED", "RENDERING", "DOWNLOADING"] }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!job) {
    console.log("No pending render jobs found in database.");
    process.exit(0);
  }

  if (!job.providerJobId) {
    console.log("Job has no providerJobId (not submitted to HeyGen).");
    process.exit(0);
  }

  console.log(`Checking HeyGen status for job ID = ${job.id}, HeyGen Render ID = ${job.providerJobId}...`);

  const client = new HeyGenHyperFramesClient();
  let result;
  try {
    result = await client.get(job.providerJobId);
  } catch (error) {
    console.error("Failed to query HeyGen status:", error);
    process.exit(1);
  }

  console.log(`HeyGen Status: ${result.status}`);

  if (result.status === "completed") {
    if (!result.videoUrl) {
      console.error("HeyGen reported completion but did not provide a videoUrl.");
      process.exit(1);
    }
    console.log(`Video is ready! URL: ${result.videoUrl}`);

    const secret = process.env.HEYGEN_HYPERFRAMES_CALLBACK_SECRET || "dev-secret";
    const body = JSON.stringify({
      callback_id: job.callbackId,
      render_id: job.providerJobId,
      status: "completed",
      video_url: result.videoUrl,
      thumbnail_url: result.thumbnailUrl
    });

    const signature = createHmac("sha256", secret).update(body).digest("hex");

    console.log("Submitting actual video callback to local server...");
    const response = await fetch("http://localhost:3000/api/v1/webhooks/hyperframes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": `sha256=${signature}`
      },
      body
    });

    const text = await response.text();
    console.log(`Local webhook responded with HTTP ${response.status}: ${text}`);
  } else if (result.status === "failed") {
    console.error(`HeyGen rendering failed: ${result.error || "Unknown error"}`);
  } else {
    console.log("Video is still rendering on HeyGen. Please wait a moment and try again.");
  }
}

run().catch(console.error);
