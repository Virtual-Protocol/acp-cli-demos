import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { env } from "@/lib/env";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const production = await prisma.production.findFirst({ where: { id, ownerUserId: auth.session.userId, status: { in: ["PAID", "LIVE_SESSION_READY", "BRIEF_REVIEW", "FAILED"] }, paymentIntents: { some: { status: "CONFIRMED" } } } });
  if (!production) return problem(auth.id, 409, "REFUND_REQUEST_NOT_AVAILABLE", "Refund request is unavailable", "Only a paid production that has not entered successful rendering can request an operator refund.");
  const existing = await prisma.approval.findFirst({ where: { productionId: id, artifactType: "PRODUCTION_REFUND_REQUEST" }, orderBy: { createdAt: "desc" } });
  if (existing) return json(existing, auth.id);
  const operator = env.productionOperatorAddress ? await prisma.wallet.findFirst({ where: { address: env.productionOperatorAddress }, select: { userId: true } }) : null;
  const requestRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.approval.create({ data: { userId: auth.session.userId, productionId: id, artifactType: "PRODUCTION_REFUND_REQUEST", artifactId: id, artifactHash: production.id, decision: "REJECTED", note: "Owner requested cancellation and refund before successful production completion." } });
    await tx.auditEvent.create({ data: { actorUserId: auth.session.userId, action: "PRODUCTION_REFUND_REQUESTED", entityType: "Production", entityId: id, requestId: auth.id } });
    if (operator) await createNotification(tx, { userId: operator.userId, kind: "PRODUCTION_REFUND_REQUESTED", title: "Production refund needs review", body: production.title, deepLink: "/admin/productions" });
    return created;
  });
  return json(requestRecord, auth.id, { status: 201 });
}
