import { createHash, randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { nexMindProposalSchema, record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { requireProductionCapability } from "@/lib/production-access";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function artifactHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({ where: { id, state: "REVIEW" } });
  if (!session) return problem(auth.id, 404, "NEXMIND_REVIEW_NOT_FOUND", "Review not found", "Prepare a structured outcome before approving it.");
  if (session.userId !== auth.session.userId && !session.productionId) return problem(auth.id, 404, "NEXMIND_REVIEW_NOT_FOUND", "Review not found", "The review is unavailable.");
  const parsed = nexMindProposalSchema.safeParse(record(session.context).proposal);
  if (!parsed.success) return problem(auth.id, 409, "NEXMIND_REVIEW_INVALID", "Review is invalid", "Ask NexMind to prepare the outcome again.");
  const proposal = parsed.data;
  const hash = artifactHash(proposal);

  if (proposal.kind === "production") {
    let productionId = session.productionId;
    if (productionId) {
      const current = await prisma.production.findUnique({ where: { id: productionId } });
      if (!current) return problem(auth.id, 404, "PRODUCTION_NOT_FOUND", "Production not found", "The linked production is unavailable.");
      const approvalAccess = await requireProductionCapability(auth.session.userId, productionId, "approveBrief");
      if (!approvalAccess) return problem(auth.id, 403, "BRIEF_APPROVAL_PERMISSION_REQUIRED", "Brief approval permission required", "The founder must approve this delegated briefing unless explicit approval permission was granted.");
      const permitted = new Set(["DRAFT", "SOURCE_READY", "DIRECTION_READY", "AWAITING_PAYMENT", "PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]);
      if (!permitted.has(current.status)) return problem(auth.id, 409, "PRODUCTION_STATE_CONFLICT", "Production cannot accept this brief", `The production is currently ${current.status}.`);
      const status = new Set(["PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(current.status) ? "BRIEF_REVIEW" : current.status === "AWAITING_PAYMENT" ? "AWAITING_PAYMENT" : "DIRECTION_READY";
      await prisma.$transaction([
        prisma.production.update({ where: { id: productionId }, data: { title: proposal.title, kind: proposal.productionKind, direction: proposal.direction as never, brief: proposal.brief as never, status } }),
        prisma.approval.create({ data: { userId: auth.session.userId, productionId, artifactType: "NEXMIND_BRIEF", artifactId: id, artifactHash: hash, decision: "APPROVED" } }),
        prisma.liveSession.update({ where: { id }, data: { state: "APPROVED", endedAt: new Date(), context: { ...record(session.context), confirmedAt: new Date().toISOString() } as never } }),
      ]);
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const production = await tx.production.create({ data: { ownerUserId: auth.session.userId, kind: proposal.productionKind, title: proposal.title, status: "DIRECTION_READY", direction: proposal.direction as never, brief: proposal.brief as never } });
        await tx.approval.create({ data: { userId: auth.session.userId, productionId: production.id, artifactType: "NEXMIND_BRIEF", artifactId: id, artifactHash: hash, decision: "APPROVED" } });
        await tx.liveSession.update({ where: { id }, data: { productionId: production.id, state: "APPROVED", endedAt: new Date(), context: { ...record(session.context), confirmedAt: new Date().toISOString() } as never } });
        return production;
      });
      productionId = created.id;
    }
    return json({ kind: proposal.kind, entityId: productionId, href: `/studio/${productionId}` }, auth.id);
  }

  if (proposal.kind === "reputation") {
    const profile = session.reputationProfileId
      ? await prisma.reputationProfile.findFirst({ where: { id: session.reputationProfileId, userId: auth.session.userId } })
      : await prisma.reputationProfile.findFirst({ where: { userId: auth.session.userId }, orderBy: { updatedAt: "desc" } });
    if (!profile) return problem(auth.id, 404, "REPUTATION_NOT_FOUND", "NexCard not found", "Create a base NexCard before adding reviewed context.");
    await prisma.$transaction([
      prisma.reputationProfile.update({ where: { id: profile.id }, data: { enhancedProfile: proposal.profile as never, status: "PROFILE_REVIEW" } }),
      prisma.approval.create({ data: { userId: auth.session.userId, artifactType: "REPUTATION_CONTEXT", artifactId: profile.id, artifactHash: hash, decision: "APPROVED" } }),
      prisma.liveSession.update({ where: { id }, data: { state: "APPROVED", endedAt: new Date(), context: { ...record(session.context), confirmedAt: new Date().toISOString() } as never } }),
    ]);
    return json({ kind: proposal.kind, entityId: profile.id, href: `/reputation?review=${id}` }, auth.id);
  }

  if (proposal.kind === "listing") {
    if (proposal.listing.type === "DIRECT_HIRE") {
      return problem(auth.id, 422, "DIRECT_HIRE_INVITEE_REQUIRED", "Choose a published NexCard first", "Direct Hire must begin from the intended recipient's public NexCard so the private offer is bound to a verified member.");
    }
    const service = proposal.listing.type === "SERVICE";
    const servicePrice = proposal.listing.budgetAtomic ? BigInt(proposal.listing.budgetAtomic) : 0n;
    if (service && servicePrice <= 0n) {
      return problem(auth.id, 422, "SERVICE_PRICE_REQUIRED", "Set a fixed Service price", "Confirm the Service price with NexMind before publishing the offer.");
    }
    const slugBase = proposal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "listing";
    const listing = await prisma.$transaction(async (tx) => {
      const created = await tx.listing.create({
        data: {
          ownerUserId: auth.session.userId,
          slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
          type: proposal.listing.type,
          title: proposal.title,
          outcome: proposal.listing.outcome,
          detail: {
            deliverables: proposal.listing.deliverables,
            skills: proposal.listing.skills,
            who: proposal.listing.who,
            approval: proposal.listing.approval,
            nexMindSessionId: id,
            ...(service ? { serviceOffer: true, buyerInputs: proposal.listing.who, deliveryDays: proposal.listing.serviceDeliveryDays } : {}),
          },
          budgetAtomic: proposal.listing.budgetAtomic ? BigInt(proposal.listing.budgetAtomic) : null,
          deadline: proposal.listing.deadline ? new Date(proposal.listing.deadline) : null,
          places: service ? 1 : proposal.listing.places,
          visibility: service ? "PUBLIC" : proposal.listing.visibility,
          status: service ? "OPEN" : "DRAFT",
          funded: false,
        },
      });
      await tx.approval.create({ data: { userId: auth.session.userId, artifactType: "LISTING_DRAFT", artifactId: created.id, artifactHash: hash, decision: "APPROVED" } });
      await tx.liveSession.update({ where: { id }, data: { state: "APPROVED", endedAt: new Date(), context: { ...record(session.context), confirmedAt: new Date().toISOString() } as never } });
      return created;
    });
    return json({ kind: proposal.kind, entityId: listing.id, href: `/marketplace/${listing.slug}` }, auth.id);
  }

  if (!proposal.application.listingId) return problem(auth.id, 409, "APPLICATION_LISTING_REQUIRED", "Choose a Listing first", "Open a Marketplace Listing and start NexMind from its application flow so the approved response has a destination.");
  const listing = await prisma.listing.findFirst({ where: { id: proposal.application.listingId, status: "OPEN" }, select: { id: true, slug: true, ownerUserId: true } });
  if (!listing) return problem(auth.id, 404, "LISTING_NOT_OPEN", "Listing is not open", "Choose another open Listing before submitting an application.");
  if (listing.ownerUserId === auth.session.userId) return problem(auth.id, 409, "OWN_LISTING_APPLICATION", "You own this Listing", "Use the applicant review flow instead.");
  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.application.create({ data: { listingId: listing.id, applicantUserId: auth.session.userId, response: proposal.application.response, deliveryPlan: proposal.application.deliveryPlan || null, availability: proposal.application.availability || null, proposedFeeAtomic: proposal.application.proposedFeeAtomic ? BigInt(proposal.application.proposedFeeAtomic) : null, evidenceIds: proposal.application.evidenceIds } });
    await tx.approval.create({ data: { userId: auth.session.userId, artifactType: "MARKETPLACE_APPLICATION", artifactId: created.id, artifactHash: hash, decision: "APPROVED" } });
    await tx.liveSession.update({ where: { id }, data: { state: "APPROVED", endedAt: new Date(), context: { ...record(session.context), confirmedAt: new Date().toISOString() } as never } });
    return created;
  }).catch(() => null);
  if (!application) return problem(auth.id, 409, "APPLICATION_EXISTS", "Application not submitted", "You may already have an application for this Listing.");
  return json({ kind: proposal.kind, entityId: application.id, href: `/marketplace/${listing.slug}` }, auth.id);
}
