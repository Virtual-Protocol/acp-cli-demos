import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { listingView, record } from "@/lib/product-view";
import { contentHash, getIdempotentResult, saveIdempotentResult } from "@/lib/store";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  message: z.string().trim().min(20).max(4_000),
  inputs: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  requestedDeadline: z.string().datetime().transform((value) => new Date(value)).optional(),
});

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const key = readIdempotencyKey(request, auth.id);
  if (key.response) return key.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const offer = await prisma.listing.findFirst({
    where: { id, type: "SERVICE", status: "OPEN", visibility: "PUBLIC" },
    include: { owner: true },
  });
  const detail = record(offer?.detail);
  if (!offer || detail.serviceOffer !== true) return problem(auth.id, 404, "SERVICE_NOT_FOUND", "Service not found", "This Service is no longer available for requests.");
  if (offer.ownerUserId === auth.session.userId) return problem(auth.id, 409, "SERVICE_OWNER_REQUEST", "You offer this Service", "Pause or edit the offer from My work instead of requesting it from yourself.");
  if (!offer.budgetAtomic || offer.budgetAtomic <= 0n) return problem(auth.id, 409, "SERVICE_PRICE_REQUIRED", "Service price is unavailable", "The provider must publish a fixed USDC price before requests can be funded.");
  const existingActive = await prisma.serviceRequest.findFirst({
    where: { serviceListingId: id, buyerUserId: auth.session.userId, status: { in: ["FUNDS_REQUIRED", "AWAITING_PROVIDER", "ACCEPTED_PENDING_ALLOCATION", "ACTIVE"] } },
    include: { requestListing: { include: { owner: true, workspace: true, _count: { select: { applications: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  if (existingActive) return json(listingView(existingActive.requestListing), auth.id);
  const hash = contentHash(parsed.data);
  const scope = `users:${auth.session.userId}:services:${id}:request`;
  try {
    const replay = await getIdempotentResult(scope, key.value!, hash);
    if (replay) return json(replay.response, auth.id, { status: replay.statusCode });
    const deliveryDays = typeof detail.deliveryDays === "number" ? Math.max(1, Math.min(365, Math.round(detail.deliveryDays))) : 7;
    const deadline = parsed.data.requestedDeadline || new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1_000);
    const serviceRequestId = crypto.randomUUID();
    const requestListingId = crypto.randomUUID();
    const slugBase = `request-${offer.slug}`.slice(0, 80);
    await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          id: requestListingId,
          ownerUserId: auth.session.userId,
          invitedUserId: offer.ownerUserId,
          slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
          type: "SERVICE",
          title: `Request: ${offer.title}`.slice(0, 140),
          outcome: parsed.data.message,
          detail: {
            serviceRequest: true,
            serviceRequestId,
            serviceOfferId: offer.id,
            serviceOfferSlug: offer.slug,
            providerUserId: offer.ownerUserId,
            deliverables: typeof detail.deliverables === "string" ? detail.deliverables : offer.outcome,
            skills: Array.isArray(detail.skills) ? detail.skills.filter((value): value is string => typeof value === "string") : [],
            who: typeof detail.buyerInputs === "string" ? detail.buyerInputs : typeof detail.who === "string" ? detail.who : "Supply the inputs stated in the request.",
            approval: typeof detail.approval === "string" ? detail.approval : "Approval follows the published Service result.",
            requestMessage: parsed.data.message,
            suppliedInputs: parsed.data.inputs,
            deliveryDays,
          },
          budgetAtomic: offer.budgetAtomic,
          deadline,
          status: "DRAFT",
          funded: false,
          visibility: "PRIVATE",
          places: 1,
        },
        include: { owner: true, workspace: true, _count: { select: { applications: true } } },
      });
      await tx.serviceRequest.create({
        data: { id: serviceRequestId, serviceListingId: offer.id, requestListingId: listing.id, buyerUserId: auth.session.userId, message: parsed.data.message, inputs: parsed.data.inputs },
      });
      return listing.id;
    });
    const requestListing = await prisma.listing.findUniqueOrThrow({ where: { id: requestListingId }, include: { owner: true, workspace: true, _count: { select: { applications: true } } } });
    const response = listingView(requestListing);
    await saveIdempotentResult(scope, key.value!, hash, 201, response);
    return json(response, auth.id, { status: 201 });
  } catch (error) {
    return problem(auth.id, 409, "SERVICE_REQUEST_FAILED", "Service request could not be saved", error instanceof Error ? error.message : "The request could not be created.");
  }
}
