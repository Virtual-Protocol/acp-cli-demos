import { z } from "zod";
import { listingFundingCalls, opaqueListingId, verifiedListingFunding, walletSnapshot } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { listingView, record } from "@/lib/product-view";
import { createNotification } from "@/lib/notifications";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("prepare") }),
  z.object({ mode: z.literal("confirm"), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }),
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
  const listing = await prisma.listing.findFirst({ where: { id, ownerUserId: auth.session.userId }, include: { owner: true, workspace: true, _count: { select: { applications: true } } } });
  if (!listing) return problem(auth.id, 404, "LISTING_NOT_FOUND", "Listing not found", "You do not own this Listing.");
  if (record(listing.detail).serviceOffer === true) return problem(auth.id, 409, "SERVICE_OFFER_NOT_FUNDED", "Service offers are not buyer work reserves", "Publish the fixed Service offer directly. A buyer secures funds when creating a private request.");
  if (listing.funded) return json(listingView(listing), auth.id);
  if (!listing.budgetAtomic || listing.budgetAtomic <= 0n) return problem(auth.id, 409, "LISTING_BUDGET_REQUIRED", "A funded offer is required", "Set the USDC amount for each place before funding the Listing.");
  const budgetAtomic = listing.budgetAtomic;
  if (!new Set(["DRAFT", "FUNDING"]).has(listing.status)) return problem(auth.id, 409, "LISTING_NOT_FUNDABLE", "Listing cannot be funded", `The Listing is currently ${listing.status}.`);
  const wallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
  if (!wallet) return problem(auth.id, 403, "WALLET_REQUIRED", "Verified wallet required", "Connect the wallet that will fund this Listing.");
  const founder = wallet.address as `0x${string}`;
  const totalAtomic = budgetAtomic * BigInt(listing.places);

  if (parsed.data.mode === "prepare") {
    if (!env.workEscrowAddress || !env.usdcAddress || !env.robinhoodRpcUrl) return problem(auth.id, 503, "WORK_ESCROW_NOT_CONFIGURED", "Listing funding is unavailable", "Configure Robinhood Chain, USDC and the NexWorkEscrow contract.");
    let snapshot;
    try { snapshot = await walletSnapshot(founder); }
    catch (error) { return problem(auth.id, 503, "WALLET_BALANCE_UNAVAILABLE", "Wallet balance unavailable", error instanceof Error ? error.message : "The Robinhood Chain balance could not be read."); }
    if (snapshot.usdcAtomic == null) return problem(auth.id, 503, "WALLET_BALANCE_UNAVAILABLE", "Wallet balance unavailable", "The configured USDC balance could not be read.");
    if (listing.status === "DRAFT") await prisma.listing.update({ where: { id }, data: { status: "FUNDING" } });
    return json({
      listingId: id,
      chainId: env.robinhoodChainId,
      founder,
      amountPerPlaceAtomic: budgetAtomic,
      places: listing.places,
      totalAtomic,
      usdcBalanceAtomic: snapshot.usdcAtomic,
      sufficientBalance: snapshot.usdcAtomic >= totalAtomic,
      calls: listingFundingCalls(id, budgetAtomic, listing.places),
    }, auth.id);
  }

  try {
    const confirmed = parsed.data;
    const verified = await verifiedListingFunding(confirmed.txHash as `0x${string}`, id, founder, budgetAtomic, listing.places);
    const event = verified.event;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.chainEvent.upsert({
        where: { chainId_transactionHash_logIndex: { chainId: env.robinhoodChainId, transactionHash: confirmed.txHash.toLowerCase(), logIndex: Number(event.logIndex ?? 0) } },
        update: { confirmedAt: new Date(), orphanedAt: null },
        create: {
          chainId: env.robinhoodChainId,
          contractAddress: env.workEscrowAddress!,
          blockNumber: verified.receipt.blockNumber,
          blockHash: verified.receipt.blockHash,
          transactionHash: confirmed.txHash.toLowerCase(),
          logIndex: Number(event.logIndex ?? 0),
          eventName: "ListingFunded",
          opaqueId: opaqueListingId(id),
          payload: { listingId: id, founder, amountPerPlaceAtomic: budgetAtomic.toString(), places: listing.places, totalAtomic: totalAtomic.toString() },
          confirmedAt: new Date(),
        },
      });
      await tx.serviceRequest.updateMany({ where: { requestListingId: id, status: "FUNDS_REQUIRED" }, data: { status: "AWAITING_PROVIDER" } });
      const next = await tx.listing.update({ where: { id }, data: { funded: true, status: "OPEN" }, include: { owner: true, workspace: true, _count: { select: { applications: true } } } });
      if (next.invitedUserId) {
        const serviceRequest = record(next.detail).serviceRequest === true;
        await createNotification(tx, { userId: next.invitedUserId, kind: serviceRequest ? "SERVICE_REQUEST" : "DIRECT_HIRE_OFFER", title: serviceRequest ? "Funded Service request" : "Private Direct Hire offer", body: serviceRequest ? `${next.owner.displayName || next.owner.handle || "A NexMarkets member"} sent a funded request for ${next.title.replace(/^Request:\s*/, "")}.` : `${next.owner.displayName || next.owner.handle || "A NexMarkets member"} invited you to ${next.title}.`, deepLink: `/marketplace/${next.slug}` });
      }
      return next;
    });
    return json(listingView(updated), auth.id);
  } catch (error) {
    return problem(auth.id, 409, "LISTING_FUNDING_NOT_VERIFIED", "Listing funding was not verified", error instanceof Error ? error.message : "The confirmed transaction did not match this Listing reserve.");
  }
}
