import { env } from "@/lib/env";
import { getPrisma } from "@/lib/db";
import { json, requestId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  const prisma = getPrisma();
  let database: "sqlite" | "postgresql" | "unavailable" = prisma
    ? env.databaseProvider
    : "unavailable";

  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "unavailable";
    }
  }

  const operations = prisma && database !== "unavailable" ? await Promise.all([
    prisma.paymentIntent.count({ where: { status: { in: ["SUBMITTED", "CONFIRMING"] } } }),
    prisma.notificationOutbox.count({ where: { deliveredAt: null } }),
    prisma.chainEvent.count({ where: { orphanedAt: { not: null } } })
  ]).catch(() => null) : null;

  return json(
    {
      status: database === "unavailable" ? "degraded" : "ok",
      service: "nexmarkets",
      experience: "componentized-data-backed-product",
      database,
      renderProvider: env.heygenApiKey ? "heygen-cloud" : "unconfigured",
      hyperframesVersion: env.hyperframesVersion,
      orm: "prisma-7",
      contractToolchain: "hardhat-3"
      ,operations: operations ? { pendingPayments: operations[0], pendingNotifications: operations[1], orphanedChainEvents: operations[2] } : null
    },
    id
  );
}
