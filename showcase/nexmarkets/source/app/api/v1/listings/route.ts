import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { contentHash, getIdempotentResult, saveIdempotentResult } from "@/lib/store";
import { json, problem, requestId, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { listingView } from "@/lib/product-view";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const listingTypes = ["TASK", "SERVICE", "ROLE", "CAMPAIGN", "DIRECT_HIRE"] as const;
const createSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  type: z.enum(listingTypes),
  title: z.string().trim().min(4).max(140),
  outcome: z.string().trim().min(10).max(2_000),
  deliverables: z.string().trim().min(4).max(4_000),
  skills: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  who: z.string().trim().max(2_000).optional(),
  approval: z.string().trim().max(2_000).optional(),
  budgetAtomic: z.string().regex(/^\d+$/).transform(BigInt).optional(),
  deadline: z.string().datetime().transform((value) => new Date(value)).optional(),
  places: z.number().int().min(1).max(100).default(1),
  serviceDeliveryDays: z.number().int().min(1).max(365).optional(),
  invitedUserId: z.string().uuid().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC")
});

export async function GET(request: Request) {
  const id = requestId(request);
  const prisma = getPrisma();
  if (!prisma) return problem(id, 503, "DATABASE_REQUIRED", "Marketplace unavailable", "A persistent database is required.");
  const url = new URL(request.url);
  const type = listingTypes.includes(url.searchParams.get("type") as never) ? url.searchParams.get("type") as (typeof listingTypes)[number] : undefined;
  const cursor = url.searchParams.get("cursor") || undefined;
  const query = url.searchParams.get("q")?.trim();
  const textFilter = query ? (env.databaseProvider === "postgresql" ? { contains: query, mode: "insensitive" as const } : { contains: query }) : undefined;
  const items = await prisma.listing.findMany({
    where: {
      status: "OPEN", visibility: "PUBLIC", type,
      OR: textFilter ? [{ title: textFilter }, { outcome: textFilter }] : undefined
    },
    include: { owner: true, workspace: true, _count: { select: { applications: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0, take: 51
  });
  const page = items.slice(0, 50);
  return json({ items: page.map(listingView), nextCursor: items.length > 50 ? page.at(-1)?.id ?? null : null }, id);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const key = readIdempotencyKey(request, auth.id);
  if (key.response) return key.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const prisma = getPrisma()!;
  if (parsed.data.type === "DIRECT_HIRE") {
    if (!parsed.data.invitedUserId) return problem(auth.id, 422, "DIRECT_HIRE_INVITEE_REQUIRED", "Choose a person to invite", "Start Direct Hire from a published NexCard so the private offer has a verified recipient.");
    if (parsed.data.invitedUserId === auth.session.userId) return problem(auth.id, 422, "DIRECT_HIRE_SELF_INVITE", "Choose another person", "A Direct Hire offer cannot be sent to its creator.");
    const invitee = await prisma.reputationProfile.findFirst({ where: { userId: parsed.data.invitedUserId, pausedAt: null }, select: { publicSettings: true } });
    if (!invitee || (invitee.publicSettings as { published?: boolean }).published !== true) return problem(auth.id, 404, "DIRECT_HIRE_INVITEE_NOT_FOUND", "Published NexCard not found", "The invited person must have a published NexCard.");
  }
  if (parsed.data.type === "SERVICE" && (!parsed.data.budgetAtomic || parsed.data.budgetAtomic <= 0n)) {
    return problem(auth.id, 422, "SERVICE_PRICE_REQUIRED", "Set a fixed Service price", "A public Service offer needs a fixed USDC price before buyers can request it.");
  }
  if (parsed.data.workspaceId) {
    const membership = await prisma.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: auth.session.userId } } });
    if (!membership || !new Set(["OWNER", "ADMIN"]).has(membership.role)) return problem(auth.id, 403, "WORKSPACE_PERMISSION_REQUIRED", "Workspace permission required", "Only a workspace owner or admin can post work.");
  }
  const hash = contentHash(parsed.data);
  const scope = `users:${auth.session.userId}:listings:create`;
  try {
    const existing = await getIdempotentResult(scope, key.value!, hash);
    if (existing) return json(existing.response, auth.id, { status: existing.statusCode });
    const slugBase = parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "listing";
    const item = await prisma.listing.create({
      data: {
        ownerUserId: auth.session.userId, invitedUserId: parsed.data.type === "DIRECT_HIRE" ? parsed.data.invitedUserId : undefined, workspaceId: parsed.data.workspaceId, slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
        type: parsed.data.type, title: parsed.data.title, outcome: parsed.data.outcome,
        detail: {
          deliverables: parsed.data.deliverables, skills: parsed.data.skills, who: parsed.data.who, approval: parsed.data.approval,
          ...(parsed.data.type === "SERVICE" ? { serviceOffer: true, buyerInputs: parsed.data.who, deliveryDays: parsed.data.serviceDeliveryDays || 7 } : {})
        },
        budgetAtomic: parsed.data.budgetAtomic, deadline: parsed.data.deadline, status: parsed.data.type === "SERVICE" ? "OPEN" : "DRAFT", funded: false,
        visibility: parsed.data.type === "DIRECT_HIRE" ? "PRIVATE" : parsed.data.type === "SERVICE" ? "PUBLIC" : parsed.data.visibility,
        places: new Set(["DIRECT_HIRE", "SERVICE"]).has(parsed.data.type) ? 1 : parsed.data.places
      },
      include: { owner: true, workspace: true, _count: { select: { applications: true } } }
    });
    const response = listingView(item);
    await saveIdempotentResult(scope, key.value!, hash, 201, response);
    return json(response, auth.id, { status: 201 });
  } catch (error) {
    return problem(auth.id, 409, "LISTING_CREATE_FAILED", "Listing could not be saved", error instanceof Error ? error.message : "The Listing could not be saved.");
  }
}
