import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { record } from "@/lib/product-view";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ response: z.string().trim().min(20).max(4_000), deliveryPlan: z.string().trim().max(4_000).optional(), availability: z.string().trim().max(500).optional(), proposedFeeAtomic: z.string().regex(/^\d+$/).transform(BigInt).optional(), evidenceIds: z.array(z.string().uuid()).max(20).default([]) });

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const listing = await prisma.listing.findFirst({ where: { id, ownerUserId: auth.session.userId }, select: { id: true } });
  if (!listing) return problem(auth.id, 404, "LISTING_NOT_FOUND", "Listing not found", "You do not own this Listing.");
  const items = await prisma.application.findMany({
    where: { listingId: id },
    include: {
      applicant: {
        select: {
          id: true, displayName: true, handle: true, avatarUrl: true, bio: true, location: true,
          wallets: { where: { isPrimary: true }, select: { address: true, chainId: true }, take: 1 },
          reputationProfiles: { select: { id: true, publicSlug: true, status: true, evidence: { where: { status: "VERIFIED", visibility: "PUBLIC" }, select: { id: true, sourceType: true, excerpt: true, sourceUrl: true, supports: true } } }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return json({ items }, auth.id);
}

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status !== "OPEN") return problem(auth.id, 409, "LISTING_NOT_OPEN", "Listing is not open", "Applications are accepted only while the Listing is open.");
  if (listing.ownerUserId === auth.session.userId) return problem(auth.id, 409, "OWNER_CANNOT_APPLY", "You own this Listing", "Use the hiring view to manage it.");
  const detail = record(listing.detail);
  if (detail.serviceOffer === true || detail.serviceRequest === true) return problem(auth.id, 409, "SERVICE_FLOW_REQUIRED", "Use the Service request flow", detail.serviceOffer === true ? "Request this fixed offer from its Service page." : "The named provider must accept or decline this funded request.");
  if (listing.visibility === "PRIVATE" && listing.invitedUserId !== auth.session.userId) return problem(auth.id, 403, "PRIVATE_INVITEE_REQUIRED", "Private offer", "Only the person named in this private Listing can respond.");
  try {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({ data: { listingId: id, applicantUserId: auth.session.userId, ...parsed.data, evidenceIds: parsed.data.evidenceIds } });
      await createNotification(tx, { userId: listing.ownerUserId, kind: "APPLICATION_SUBMITTED", title: "New application", body: `A member applied for ${listing.title}.`, deepLink: `/marketplace/${listing.slug}` });
      return created;
    });
    return json(application, auth.id, { status: 201 });
  } catch {
    return problem(auth.id, 409, "APPLICATION_EXISTS", "Application already submitted", "You can only have one application for this Listing.");
  }
}
