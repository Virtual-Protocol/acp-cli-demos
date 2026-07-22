import { z } from "zod";
import { opaqueWorkroomId, verifiedWorkroomEvent } from "@/lib/chain";
import { persistWorkEscrowEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { workroomPayloadHash } from "@/lib/workroom";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ request: z.string().trim().min(2).max(4_000), deliveryId: z.string().uuid().optional(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) });
export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params; const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, founderUserId: auth.session.userId, status: "DELIVERED" } });
  if (!room) return problem(auth.id, 409, "REVISION_NOT_ALLOWED", "Revision is not available", "Only the hiring side can request a revision on a delivered Workroom.");
  const hash = workroomPayloadHash({ action: "revision", request: parsed.data.request, deliveryId: parsed.data.deliveryId });
  try {
    const verified = await verifiedWorkroomEvent(parsed.data.txHash, id, "RevisionRequested", hash);
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "RevisionRequested", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id, requestHash: hash }, verified });
    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.workroomRevision.create({ data: { workroomId: id, requestedById: auth.session.userId, request: parsed.data.request, deliveryId: parsed.data.deliveryId } });
      await tx.workroom.update({ where: { id }, data: { status: "REVISION_REQUESTED" } });
      if (parsed.data.deliveryId) await tx.workroomDelivery.update({ where: { id: parsed.data.deliveryId }, data: { status: "REVISION_REQUESTED" } });
      await createNotification(tx, { userId: room.workerUserId, kind: "REVISION_REQUESTED", title: "Revision requested", body: parsed.data.request.slice(0, 180), deepLink: `/workrooms/${id}?tab=delivery` });
      return created;
    });
    return json(revision, auth.id, { status: 201 });
  } catch (error) { return problem(auth.id, 409, "REVISION_TX_INVALID", "Revision transaction is invalid", error instanceof Error ? error.message : "The revision could not be verified."); }
}
