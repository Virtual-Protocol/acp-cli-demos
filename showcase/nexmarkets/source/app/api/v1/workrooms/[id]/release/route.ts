import { z } from "zod";
import { opaqueWorkroomId, verifiedWorkroomEvent } from "@/lib/chain";
import { persistWorkEscrowEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params; const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, status: "APPROVED", OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }] }, include: { listing: true } });
  if (!room) return problem(auth.id, 409, "RELEASE_NOT_ALLOWED", "Payment release is not available", "The delivery must be approved before either participant can confirm release.");
  try {
    const verified = await verifiedWorkroomEvent(parsed.data.txHash, id, "PaymentReleased");
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "PaymentReleased", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id }, verified });
    const args = verified.event.args as { workerAmount?: bigint; feeAmount?: bigint };
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.workroom.update({ where: { id }, data: { status: "RELEASED" } });
      await tx.listing.update({ where: { id: room.listingId }, data: { status: "COMPLETED" } });
      await tx.serviceRequest.updateMany({ where: { requestListingId: room.listingId }, data: { status: "COMPLETED" } });
      const profile = await tx.reputationProfile.findFirst({ where: { userId: room.workerUserId }, orderBy: { updatedAt: "desc" } });
      if (profile) await tx.reputationEvidence.create({ data: { profileId: profile.id, sourceType: "MARKETPLACE_WORK", sourceUrl: `/workrooms/${id}`, sourceDate: new Date(), excerpt: room.listing.title, supports: { listingId: room.listingId, workroomId: id, outcome: room.listing.outcome }, visibility: "PUBLIC", confidence: 100, status: "VERIFIED" } });
      await createNotifications(tx, [
        { userId: room.workerUserId, kind: "PAYMENT_RELEASED", title: "Marketplace payment released", body: `${room.listing.title}: ${String(args.workerAmount ?? room.listing.budgetAtomic ?? 0n)} atomic USDC released.`, deepLink: `/workrooms/${id}?tab=payment` },
        { userId: room.founderUserId, kind: "PAYMENT_RELEASED", title: "Marketplace payment released", body: `${room.listing.title} is complete.`, deepLink: `/workrooms/${id}?tab=payment` },
      ]);
      return next;
    });
    return json({ workroom: updated, workerAmount: args.workerAmount ?? null, feeAmount: args.feeAmount ?? null }, auth.id);
  } catch (error) { return problem(auth.id, 409, "RELEASE_TX_INVALID", "Release transaction is invalid", error instanceof Error ? error.message : "The release could not be verified."); }
}
