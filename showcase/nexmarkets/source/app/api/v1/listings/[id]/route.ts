import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { json, problem, requestId, zodProblem } from "@/lib/http";
import { listingView } from "@/lib/product-view";
import { requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(4).max(140).optional(), outcome: z.string().trim().min(10).max(2_000).optional(),
  detail: z.record(z.string(), z.unknown()).optional(), deadline: z.string().datetime().nullable().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(), status: z.enum(["DRAFT", "OPEN", "PAUSED", "CANCELLED"]).optional()
});

function identifierWhere(identifier: string) {
  return { OR: [{ id: identifier }, { slug: identifier }] };
}

export async function GET(request: Request, context: Context) {
  const requestIdentifier = requestId(request);
  const prisma = getPrisma();
  if (!prisma) return problem(requestIdentifier, 503, "DATABASE_REQUIRED", "Marketplace unavailable", "A persistent database is required.");
  const { id: identifier } = await context.params;
  const session = await getSession(request);
  const item = await prisma.listing.findFirst({
    where: {
      AND: [
        identifierWhere(identifier),
        { OR: [{ status: "OPEN", visibility: "PUBLIC" }, ...(session ? [{ ownerUserId: session.userId }, { invitedUserId: session.userId, status: "OPEN" as const }] : [])] }
      ]
    },
    include: { owner: true, workspace: true, _count: { select: { applications: true } } }
  });
  return item ? json(listingView(item), requestIdentifier) : problem(requestIdentifier, 404, "LISTING_NOT_FOUND", "Listing not found", "The Listing is unavailable or private.");
}

export async function PATCH(request: Request, context: Context) {
  const requestIdentifier = requestId(request);
  const session = await getSession(request);
  if (!session) return problem(requestIdentifier, 401, "AUTHENTICATION_REQUIRED", "Sign in required", "Connect your verified wallet to continue.");
  const originError = requireTrustedOrigin(request, requestIdentifier);
  if (originError) return originError;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(requestIdentifier, parsed.error);
  const { id: identifier } = await context.params;
  const prisma = getPrisma()!;
  const current = await prisma.listing.findFirst({ where: { AND: [identifierWhere(identifier), { ownerUserId: session.userId }] } });
  if (!current) return problem(requestIdentifier, 404, "LISTING_NOT_FOUND", "Listing not found", "You do not own this Listing.");
  const detail = current.detail && typeof current.detail === "object" && !Array.isArray(current.detail) ? current.detail as Record<string, unknown> : {};
  const serviceAvailabilityChange = detail.serviceOffer === true && parsed.data.status && new Set(["OPEN", "PAUSED"]).has(parsed.data.status);
  if (!serviceAvailabilityChange && !new Set(["DRAFT", "PAUSED"]).has(current.status)) return problem(requestIdentifier, 409, "LISTING_LOCKED", "Listing fields are locked", "Published scope and payment terms cannot be silently changed.");
  if (parsed.data.status === "OPEN" && detail.serviceOffer !== true) return problem(requestIdentifier, 409, "LISTING_FUNDING_REQUIRED", "Listing cannot be opened directly", "Non-Service Listings open only after their on-chain reserve is verified.");
  const item = await prisma.listing.update({
    where: { id: current.id }, data: { ...parsed.data, detail: parsed.data.detail as never, deadline: parsed.data.deadline === null ? null : parsed.data.deadline ? new Date(parsed.data.deadline) : undefined },
    include: { owner: true, workspace: true, _count: { select: { applications: true } } }
  });
  return json(listingView(item), requestIdentifier);
}
