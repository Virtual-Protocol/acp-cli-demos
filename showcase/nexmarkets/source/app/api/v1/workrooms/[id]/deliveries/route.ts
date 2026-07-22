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
const schema = z.object({ message: z.string().trim().min(2).max(4_000), objectKeys: z.array(z.string()).max(20).default([]), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, workerUserId: auth.session.userId } });
  if (!room || !new Set(["IN_PROGRESS", "REVISION_REQUESTED"]).has(room.status)) return problem(auth.id, 409, "DELIVERY_NOT_ALLOWED", "Delivery is not available", "Only the selected worker can deliver while work is active.");
  const uniqueObjectKeys = [...new Set(parsed.data.objectKeys)];
  if (uniqueObjectKeys.length) {
    const ownedFiles = await prisma.source.count({ where: { ownerUserId: auth.session.userId, objectKey: { in: uniqueObjectKeys } } });
    if (ownedFiles !== uniqueObjectKeys.length) return problem(auth.id, 422, "DELIVERY_FILE_INVALID", "Delivery file is invalid", "Every attached file must be an upload owned by the selected worker.");
  }
  const payload = { action: "delivery", message: parsed.data.message, objectKeys: parsed.data.objectKeys };
  const hash = workroomPayloadHash(payload);
  try {
    const verified = await verifiedWorkroomEvent(parsed.data.txHash, id, "DeliverySubmitted", hash);
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "DeliverySubmitted", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id, deliveryHash: hash }, verified });
    const latest = await prisma.workroomDelivery.findFirst({ where: { workroomId: id }, orderBy: { version: "desc" } });
    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.workroomDelivery.create({ data: { workroomId: id, submittedById: auth.session.userId, version: (latest?.version ?? 0) + 1, message: parsed.data.message, objectKeys: parsed.data.objectKeys } });
      const reviewDeadline = (verified.event.args as { reviewDeadline: bigint }).reviewDeadline;
      await tx.workroom.update({ where: { id }, data: { status: "DELIVERED", reviewDeadline: new Date(Number(reviewDeadline) * 1000) } });
      await tx.workroomRevision.updateMany({ where: { workroomId: id, resolvedAt: null }, data: { resolvedAt: new Date() } });
      await createNotification(tx, { userId: room.founderUserId, kind: "DELIVERY_SUBMITTED", title: "Delivery ready for review", body: parsed.data.message.slice(0, 180), deepLink: `/workrooms/${id}?tab=delivery` });
      return created;
    });
    return json(delivery, auth.id, { status: 201 });
  } catch (error) {
    return problem(auth.id, 409, "DELIVERY_TX_INVALID", "Delivery transaction is invalid", error instanceof Error ? error.message : "The delivery could not be verified.");
  }
}
