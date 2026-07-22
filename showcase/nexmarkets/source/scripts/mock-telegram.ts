import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import { encryptSecret } from "../src/lib/secrets";

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error("Prisma client not initialized");
    process.exit(1);
  }

  // Find the dev user
  const user = await prisma.user.findUnique({
    where: { email: "dev@nexmarkets.local" }
  });

  if (!user) {
    console.error("Dev user not found. Please sign in as dev first.");
    process.exit(1);
  }

  // Check if already connected
  const existing = await prisma.telegramConnection.findFirst({
    where: { userId: user.id, revokedAt: null }
  });

  if (existing) {
    console.log("Dev user already has a connected Telegram!");
    process.exit(0);
  }

  // Create mock Telegram connection
  await prisma.telegramConnection.create({
    data: {
      userId: user.id,
      chatIdEncrypted: encryptSecret("12345678"),
      username: "mock_dev_bot",
      verifiedAt: new Date()
    }
  });

  console.log("Mock Telegram connection successfully created for Dev User!");
}

run().catch(console.error);
