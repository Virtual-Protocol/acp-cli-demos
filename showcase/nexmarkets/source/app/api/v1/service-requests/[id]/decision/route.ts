import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("accept"), note: z.string().trim().max(2_000).optional() }),
  z.object({ decision: z.literal("decline"), note: z.string().trim().min(4).max(2_000) }),
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
  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: { id, status: "AWAITING_PROVIDER", serviceListing: { ownerUserId: auth.session.userId } },
    include: { serviceListing: true, requestListing: true },
  });
  if (!serviceRequest) return problem(auth.id, 404, "SERVICE_REQUEST_NOT_FOUND", "Service request not found", "Only the named provider can decide an awaiting request.");
  if (!serviceRequest.requestListing.funded || serviceRequest.requestListing.status !== "OPEN") return problem(auth.id, 409, "SERVICE_REQUEST_NOT_FUNDED", "Request funding is unavailable", "The buyer must secure the request funds before the provider can accept it.");

  if (parsed.data.decision === "decline") {
    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({ where: { id }, data: { status: "DECLINED" } });
      await tx.listing.update({ where: { id: serviceRequest.requestListingId }, data: { status: "PAUSED" } });
      await createNotification(tx, { userId: serviceRequest.buyerUserId, kind: "SERVICE_REQUEST_DECLINED", title: "Service request declined", body: `${serviceRequest.serviceListing.title} is not available for this request. Return to the request to refund the secured amount.`, deepLink: `/marketplace/${serviceRequest.requestListing.slug}` });
    });
    return json({ id, status: "DECLINED" }, auth.id);
  }

  const wallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
  if (!wallet) return problem(auth.id, 409, "PROVIDER_WALLET_REQUIRED", "Receiving wallet required", "Verify the wallet that should receive payment before accepting the Service request.");
  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.application.create({
      data: {
        listingId: serviceRequest.requestListingId,
        applicantUserId: auth.session.userId,
        proposedFeeAtomic: serviceRequest.requestListing.budgetAtomic,
        response: parsed.data.note || `I accept the published ${serviceRequest.serviceListing.title} request and its fixed scope.`,
        deliveryPlan: `Deliver under the published Service offer and the buyer's supplied request record.`,
      },
    });
    await tx.serviceRequest.update({ where: { id }, data: { status: "ACCEPTED_PENDING_ALLOCATION" } });
    await createNotification(tx, { userId: serviceRequest.buyerUserId, kind: "SERVICE_REQUEST_ACCEPTED", title: "Service request accepted", body: `${serviceRequest.serviceListing.title} is ready to move into its funded Workroom.`, deepLink: `/marketplace/${serviceRequest.requestListing.slug}` });
    return created;
  });
  return json(application, auth.id, { status: 201 });
}
