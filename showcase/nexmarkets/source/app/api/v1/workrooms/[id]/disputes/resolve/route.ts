import { z } from "zod";
import { disputeResolutionCall, opaqueWorkroomId, verifiedDisputeResolution } from "@/lib/chain";
import { persistWorkEscrowEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { isDisputeResolver } from "@/lib/roles";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const amounts = {
  founderAmountAtomic: z.string().regex(/^\d+$/).transform(BigInt),
  workerGrossAmountAtomic: z.string().regex(/^\d+$/).transform(BigInt),
  rationale: z.string().trim().min(20).max(4_000),
};
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("prepare"), ...amounts }),
  z.object({ mode: z.literal("confirm"), ...amounts, txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) }),
]);

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!isDisputeResolver(auth.session.user)) return problem(auth.id, 403, "DISPUTE_RESOLVER_REQUIRED", "Resolver access required", "Use the verified wallet configured for the on-chain dispute resolver role.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, status: "DISPUTED" }, include: { listing: true, disputes: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!room?.listing.budgetAtomic || !room.disputes[0]) return problem(auth.id, 409, "OPEN_DISPUTE_REQUIRED", "Open dispute required", "This Workroom does not have an unresolved funded dispute.");
  const total = room.listing.budgetAtomic;
  if (parsed.data.founderAmountAtomic + parsed.data.workerGrossAmountAtomic !== total) return problem(auth.id, 422, "DISPUTE_SPLIT_INVALID", "Resolution split is invalid", "The founder amount and worker gross amount must equal the full escrow amount.");
  const resolverWallet = auth.session.user.wallets.find((wallet) => wallet.address.toLowerCase() === env.disputeResolverAddress);
  if (!resolverWallet) return problem(auth.id, 403, "RESOLVER_WALLET_REQUIRED", "Resolver wallet required", "Connect the configured resolver wallet.");
  if (parsed.data.mode === "prepare") {
    return json({ workroomId: id, chainId: env.robinhoodChainId, totalAtomic: total, call: disputeResolutionCall(id, parsed.data.founderAmountAtomic, parsed.data.workerGrossAmountAtomic) }, auth.id);
  }
  try {
    const verified = await verifiedDisputeResolution(parsed.data.txHash, id, parsed.data.founderAmountAtomic, parsed.data.workerGrossAmountAtomic, resolverWallet.address as `0x${string}`);
    const args = verified.event.args;
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "DisputeResolved", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id, founderAmountAtomic: parsed.data.founderAmountAtomic, workerGrossAmountAtomic: parsed.data.workerGrossAmountAtomic, workerAmountAtomic: args.workerAmount, feeAmountAtomic: args.feeAmount }, verified });
    const resolution = { rationale: parsed.data.rationale, txHash: parsed.data.txHash, founderAmountAtomic: parsed.data.founderAmountAtomic.toString(), workerGrossAmountAtomic: parsed.data.workerGrossAmountAtomic.toString(), workerAmountAtomic: String(args.workerAmount ?? 0n), feeAmountAtomic: String(args.feeAmount ?? 0n) };
    const updated = await prisma.$transaction(async (tx) => {
      await tx.workroomDispute.update({ where: { id: room.disputes[0].id }, data: { status: "RESOLVED", resolvedById: auth.session.userId, resolvedAt: new Date(), resolution } });
      const workroom = await tx.workroom.update({ where: { id }, data: { status: "RELEASED" } });
      await tx.listing.update({ where: { id: room.listingId }, data: { status: parsed.data.workerGrossAmountAtomic > 0n ? "COMPLETED" : "CANCELLED" } });
      await tx.serviceRequest.updateMany({ where: { requestListingId: room.listingId }, data: { status: parsed.data.workerGrossAmountAtomic > 0n ? "COMPLETED" : "REFUNDED" } });
      await tx.auditEvent.create({ data: { actorUserId: auth.session.userId, actorWallet: resolverWallet.address, action: "DISPUTE_RESOLVED", entityType: "Workroom", entityId: id, after: resolution, requestId: auth.id } });
      await createNotifications(tx, [
        { userId: room.founderUserId, kind: "DISPUTE_RESOLVED", title: "Workroom dispute resolved", body: parsed.data.rationale, deepLink: `/workrooms/${id}?tab=payment` },
        { userId: room.workerUserId, kind: "DISPUTE_RESOLVED", title: "Workroom dispute resolved", body: parsed.data.rationale, deepLink: `/workrooms/${id}?tab=payment` },
      ]);
      return workroom;
    });
    return json({ workroom: updated, resolution }, auth.id);
  } catch (error) {
    return problem(auth.id, 409, "DISPUTE_RESOLUTION_NOT_VERIFIED", "Dispute resolution was not verified", error instanceof Error ? error.message : "The confirmed transaction did not match this resolution split.");
  }
}
