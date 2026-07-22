import { z } from "zod";
import { listingRefundCall, opaqueListingId, verifiedListingRefund } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("prepare") }),
  z.object({ mode: z.literal("confirm"), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }),
  z.object({ mode: z.literal("cancel-draft") })
]);

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const listing = await prisma.listing.findFirst({ where: { id, ownerUserId: auth.session.userId }, include: { workrooms: true, serviceRequest: true } });
  if (!listing) return problem(auth.id, 404, "LISTING_NOT_FOUND", "Listing not found", "You do not own this Listing.");
  if (parsed.data.mode === "cancel-draft") {
    if (listing.status !== "DRAFT" || listing.funded) return problem(auth.id, 409, "DRAFT_CANCEL_NOT_ALLOWED", "Draft cannot be cancelled locally", "A funded or submitted Listing must reconcile its on-chain reserve first.");
    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.updateMany({ where: { requestListingId: id }, data: { status: "CANCELLED" } });
      return tx.listing.update({ where: { id }, data: { status: "CANCELLED" } });
    });
    return json(cancelled, auth.id);
  }
  const declinedServiceRequest = listing.status === "PAUSED" && listing.serviceRequest?.status === "DECLINED";
  if (!listing.funded || (!declinedServiceRequest && listing.status !== "OPEN") || !listing.budgetAtomic) return problem(auth.id, 409, "LISTING_REFUND_NOT_AVAILABLE", "Unused reserve refund is unavailable", "Only an open funded Listing or a provider-declined Service request can be cancelled and refunded.");
  const remainingPlaces = listing.places - listing.workrooms.length;
  if (remainingPlaces <= 0) return problem(auth.id, 409, "NO_UNUSED_RESERVE", "No unused reserve remains", "Every funded place has already been allocated to a Workroom.");
  const amountAtomic = listing.budgetAtomic * BigInt(remainingPlaces);
  const wallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
  if (!wallet) return problem(auth.id, 403, "WALLET_REQUIRED", "Verified wallet required", "Use the wallet that funded this Listing.");
  const founder = wallet.address as `0x${string}`;
  if (parsed.data.mode === "prepare") {
    try { return json({ listingId: id, amountAtomic, remainingPlaces, chainId: env.robinhoodChainId, call: listingRefundCall(id) }, auth.id); }
    catch (error) { return problem(auth.id, 503, "WORK_ESCROW_NOT_CONFIGURED", "Listing refund is unavailable", error instanceof Error ? error.message : "Configure NexWorkEscrow."); }
  }
  const txHash = parsed.data.txHash;
  try {
    const verified = await verifiedListingRefund(txHash as `0x${string}`, id, founder, amountAtomic);
    const event = verified.event;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.chainEvent.upsert({
        where: { chainId_transactionHash_logIndex: { chainId: env.robinhoodChainId, transactionHash: txHash.toLowerCase(), logIndex: Number(event.logIndex ?? 0) } },
        update: { confirmedAt: new Date(), orphanedAt: null },
        create: { chainId: env.robinhoodChainId, contractAddress: env.workEscrowAddress!, blockNumber: verified.receipt.blockNumber, blockHash: verified.receipt.blockHash, transactionHash: txHash.toLowerCase(), logIndex: Number(event.logIndex ?? 0), eventName: "ListingRefunded", opaqueId: opaqueListingId(id), payload: { listingId: id, founder, amountAtomic: amountAtomic.toString(), remainingPlaces }, confirmedAt: new Date() }
      });
      await tx.application.updateMany({ where: { listingId: id, status: { in: ["SUBMITTED", "SHORTLISTED"] } }, data: { status: "DECLINED" } });
      await tx.serviceRequest.updateMany({ where: { requestListingId: id }, data: { status: "REFUNDED" } });
      return tx.listing.update({ where: { id }, data: { funded: false, status: "CANCELLED" } });
    });
    return json({ listing: updated, refundedAtomic: amountAtomic }, auth.id);
  } catch (error) {
    return problem(auth.id, 409, "LISTING_REFUND_NOT_VERIFIED", "Listing refund was not verified", error instanceof Error ? error.message : "The transaction did not refund this Listing reserve.");
  }
}
