import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { record } from "@/lib/product-view";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  productionId: z.string().uuid(),
  canApproveBrief: z.boolean().default(false),
  expiresAt: z.string().datetime().transform((value) => new Date(value)),
});

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const expiresAt = parsed.data.expiresAt;
  if (expiresAt.getTime() <= Date.now() + 5 * 60 * 1_000 || expiresAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1_000) {
    return problem(auth.id, 422, "DELEGATION_EXPIRY_INVALID", "Choose a valid permission expiry", "Delegated briefing access must last at least five minutes and no more than 30 days.");
  }
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, founderUserId: auth.session.userId, status: { in: ["FUNDED", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"] } } });
  if (!room) return problem(auth.id, 404, "WORKROOM_NOT_FOUND", "Workroom not found", "Only the hiring side of an active Workroom can grant briefing access.");
  const production = await prisma.production.findFirst({ where: { id: parsed.data.productionId, ownerUserId: auth.session.userId, status: { in: ["PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"] } } });
  if (!production) return problem(auth.id, 409, "PRODUCTION_NOT_DELEGATABLE", "Production cannot be delegated", "Choose your paid production before its final output is approved.");
  const before = record(room.permissions);
  const delegation = {
    productionId: production.id,
    delegateUserId: room.workerUserId,
    canBrief: true,
    canApproveBrief: parsed.data.canApproveBrief,
    expiresAt: expiresAt.toISOString(),
    grantedAt: new Date().toISOString(),
    grantedByUserId: auth.session.userId,
  };
  const permissions = { ...before, productionDelegation: delegation };
  await prisma.$transaction(async (tx) => {
    await tx.workroom.update({ where: { id }, data: { permissions } });
    await tx.production.update({ where: { id: production.id }, data: { sessionParticipantUserId: room.workerUserId } });
    await tx.auditEvent.create({ data: { actorUserId: auth.session.userId, action: "PRODUCTION_DELEGATION_GRANTED", entityType: "Workroom", entityId: id, before: before as never, after: permissions as never, requestId: auth.id } });
    await createNotification(tx, { userId: room.workerUserId, kind: "PRODUCTION_DELEGATED", title: "Studio briefing access granted", body: `${production.title} is available for a delegated NexMind briefing until ${expiresAt.toLocaleString()}.`, deepLink: `/studio/${production.id}` });
  });
  return json(delegation, auth.id, { status: 201 });
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, founderUserId: auth.session.userId } });
  if (!room) return problem(auth.id, 404, "WORKROOM_NOT_FOUND", "Workroom not found", "Only the hiring side can revoke briefing access.");
  const before = record(room.permissions);
  const delegation = record(before.productionDelegation);
  if (!delegation.productionId) return json({ revoked: false }, auth.id);
  const permissions = { ...before, productionDelegation: { ...delegation, revokedAt: new Date().toISOString(), revokedByUserId: auth.session.userId } };
  await prisma.$transaction(async (tx) => {
    await tx.workroom.update({ where: { id }, data: { permissions } });
    await tx.production.updateMany({ where: { id: String(delegation.productionId), sessionParticipantUserId: room.workerUserId }, data: { sessionParticipantUserId: null } });
    await tx.auditEvent.create({ data: { actorUserId: auth.session.userId, action: "PRODUCTION_DELEGATION_REVOKED", entityType: "Workroom", entityId: id, before: before as never, after: permissions as never, requestId: auth.id } });
    await createNotification(tx, { userId: room.workerUserId, kind: "PRODUCTION_DELEGATION_REVOKED", title: "Studio briefing access ended", body: "Delegated briefing permission for this Workroom was revoked.", deepLink: `/workrooms/${id}` });
  });
  return json({ revoked: true }, auth.id);
}
