import { randomUUID } from "node:crypto";
import { z } from "zod";
import { listingAssignmentCall, opaqueListingId, opaqueWorkroomId, verifiedListingAssignment } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { record } from "@/lib/product-view";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("prepare"), applicationId: z.string().uuid(), autoRelease: z.boolean().default(false) }),
  z.object({ mode: z.literal("confirm"), applicationId: z.string().uuid(), workroomId: z.string().uuid(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), autoRelease: z.boolean().default(false) }),
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
  const listing = await prisma.listing.findFirst({
    where: { id, ownerUserId: auth.session.userId },
    include: { applications: { include: { applicant: { include: { wallets: true } } } }, workrooms: true },
  });
  if (!listing) return problem(auth.id, 404, "LISTING_NOT_FOUND", "Listing not found", "You do not own this Listing.");
  if (!listing.funded || !listing.budgetAtomic) return problem(auth.id, 409, "LISTING_NOT_FUNDED", "Funding is not confirmed", "Confirm the on-chain Listing reserve before hiring.");
  const budgetAtomic = listing.budgetAtomic;
  if (!new Set(["OPEN", "ASSIGNED"]).has(listing.status)) return problem(auth.id, 409, "LISTING_NOT_HIRING", "Listing is not hiring", `The Listing is currently ${listing.status}.`);
  if (listing.workrooms.length >= listing.places) return problem(auth.id, 409, "LISTING_PLACES_FILLED", "All places are filled", "Every funded place already has a Workroom.");
  const application = listing.applications.find((item) => item.id === parsed.data.applicationId);
  if (!application) return problem(auth.id, 404, "APPLICATION_NOT_FOUND", "Application not found", "Choose an application submitted to this Listing.");
  if (!new Set(["SUBMITTED", "SHORTLISTED"]).has(application.status)) return problem(auth.id, 409, "APPLICATION_NOT_HIRABLE", "Application cannot be hired", `The application is currently ${application.status}.`);
  const workerWallet = application.applicant.wallets.find((item) => item.isPrimary) ?? application.applicant.wallets[0];
  if (!workerWallet && process.env.NODE_ENV !== "development") return problem(auth.id, 409, "WORKER_WALLET_REQUIRED", "Worker wallet required", "The applicant must verify a receiving wallet before this funded place can be assigned.");
  const founderWallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
  if (!founderWallet && process.env.NODE_ENV !== "development") return problem(auth.id, 409, "FOUNDER_WALLET_REQUIRED", "Founder wallet required", "Use the verified wallet that funded this Listing.");
  if (!env.workEscrowAddress || !env.robinhoodRpcUrl) {
    if (process.env.NODE_ENV !== "development") {
      return problem(auth.id, 503, "WORK_ESCROW_NOT_CONFIGURED", "Workroom assignment is unavailable", "Configure Robinhood Chain and NexWorkEscrow.");
    }
  }
  const worker = (workerWallet?.address || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const founder = (founderWallet?.address || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e") as `0x${string}`;

  if (parsed.data.mode === "prepare") {
    const workroomId = randomUUID();
    return json({
      listingId: id,
      applicationId: application.id,
      workroomId,
      founder,
      worker,
      amountAtomic: budgetAtomic,
      chainId: env.robinhoodChainId,
      autoRelease: parsed.data.autoRelease,
      call: listingAssignmentCall(id, workroomId, worker, parsed.data.autoRelease),
    }, auth.id);
  }

  const confirmed = parsed.data;
  const existing = await prisma.workroom.findUnique({ where: { id: confirmed.workroomId } });
  if (existing) return json(existing, auth.id);
  try {
    const verified = await verifiedListingAssignment(confirmed.txHash as `0x${string}`, id, confirmed.workroomId, founder, worker, budgetAtomic);
    const event = verified.event;
    const workroom = await prisma.$transaction(async (tx) => {
      const filled = listing.workrooms.length + 1 >= listing.places;
      if (filled) await tx.application.updateMany({ where: { listingId: id, id: { not: application.id }, status: { in: ["SUBMITTED", "SHORTLISTED"] } }, data: { status: "DECLINED" } });
      await tx.application.update({ where: { id: application.id }, data: { status: "ACCEPTED" } });
      await tx.listing.update({ where: { id }, data: { status: filled ? "ASSIGNED" : "OPEN" } });
      await tx.serviceRequest.updateMany({ where: { requestListingId: id, status: "ACCEPTED_PENDING_ALLOCATION" }, data: { status: "ACTIVE" } });
      await tx.chainEvent.upsert({
        where: { chainId_transactionHash_logIndex: { chainId: env.robinhoodChainId, transactionHash: confirmed.txHash.toLowerCase(), logIndex: Number(event.logIndex ?? 0) } },
        update: { confirmedAt: new Date(), orphanedAt: null },
        create: { chainId: env.robinhoodChainId, contractAddress: env.workEscrowAddress!, blockNumber: verified.receipt.blockNumber, blockHash: verified.receipt.blockHash, transactionHash: confirmed.txHash.toLowerCase(), logIndex: Number(event.logIndex ?? 0), eventName: "ListingAllocated", opaqueId: opaqueListingId(id), payload: { listingId: id, workroomId: confirmed.workroomId, worker, amountAtomic: budgetAtomic.toString() }, confirmedAt: new Date() },
      });
      const created = await tx.workroom.create({ data: { id: confirmed.workroomId, listingId: id, founderUserId: auth.session.userId, workerUserId: application.applicantUserId, status: "IN_PROGRESS", scope: { ...record(listing.detail), applicationId: application.id, response: application.response, deliveryPlan: application.deliveryPlan }, escrowId: opaqueWorkroomId(confirmed.workroomId), permissions: { autoRelease: confirmed.autoRelease } } });
      await createNotifications(tx, [
        { userId: application.applicantUserId, kind: "APPLICATION_ACCEPTED", title: "Application accepted", body: `${listing.title} now has a Workroom.`, deepLink: `/workrooms/${created.id}` },
        { userId: auth.session.userId, kind: "WORKROOM_CREATED", title: "Workroom ready", body: `The Workroom for ${listing.title} is ready.`, deepLink: `/workrooms/${created.id}` },
      ]);
      return created;
    });
    return json(workroom, auth.id, { status: 201 });
  } catch (error) {
    return problem(auth.id, 409, "WORKROOM_ASSIGNMENT_NOT_VERIFIED", "Workroom assignment was not verified", error instanceof Error ? error.message : "The transaction did not allocate this funded place to the selected applicant.");
  }
}
