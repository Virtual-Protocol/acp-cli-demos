import { z } from "zod";
import { opaqueWorkroomId, verifiedWorkroomEvent } from "@/lib/chain";
import { persistWorkEscrowEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) });
export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params; const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, founderUserId: auth.session.userId, status: "DELIVERED" } });
  if (!room) return problem(auth.id, 409, "APPROVAL_NOT_ALLOWED", "Approval is not available", "Only the hiring side can approve delivered work.");
  try {
    const verified = await verifiedWorkroomEvent(parsed.data.txHash, id, "DeliveryApproved");
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "DeliveryApproved", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id }, verified });
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.workroom.update({ where: { id }, data: { status: "APPROVED", deliveries: { updateMany: { where: { status: "SUBMITTED" }, data: { status: "APPROVED" } } } } });
      await createNotification(tx, { userId: room.workerUserId, kind: "DELIVERY_APPROVED", title: "Delivery approved", body: "The hiring side approved the delivered work. Payment release is now available.", deepLink: `/workrooms/${id}?tab=payment` });
      return next;
    });
    return json(updated, auth.id);
  } catch (error) { return problem(auth.id, 409, "APPROVAL_TX_INVALID", "Approval transaction is invalid", error instanceof Error ? error.message : "The approval could not be verified."); }
}
