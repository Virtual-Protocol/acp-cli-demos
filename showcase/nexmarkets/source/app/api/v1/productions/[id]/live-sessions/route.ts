import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { ownedReadySources, sourceIdsFromUnknown, sourceMetadata } from "@/lib/source-grounding";
import { record } from "@/lib/nexmind";
import { requireProductionCapability } from "@/lib/production-access";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ context: z.record(z.string(), z.unknown()).default({}) });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!env.nexmindApiUrl || !env.nexmindApiKey) return problem(auth.id, 503, "NEXMIND_NOT_CONFIGURED", "NexMind is unavailable", "Configure the NexMind provider.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const access = await requireProductionCapability(auth.session.userId, id, "brief");
  if (!access) return problem(auth.id, 403, "PRODUCTION_BRIEF_PERMISSION_REQUIRED", "Briefing permission required", "Only the production owner or an active delegated Workroom participant can start this session.");
  const production = await prisma.production.findFirst({
    where: { id },
    include: { source: { select: { id: true, name: true, kind: true, extracted: true, rights: true, status: true } } },
  });
  if (!production) return problem(auth.id, 404, "PRODUCTION_NOT_FOUND", "Production not found", "The production is unavailable.");
  const existing = await prisma.liveSession.findFirst({ where: { productionId: id, userId: auth.session.userId, state: { in: ["ACTIVE", "REVIEW"] } }, orderBy: { updatedAt: "desc" } });
  if (existing) return json(existing, auth.id);
  if (!new Set(["DIRECTION_READY", "AWAITING_PAYMENT", "PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(production.status)) return problem(auth.id, 409, "PRODUCTION_NOT_READY_FOR_NEXMIND", "Production is not ready", "Save a production direction before starting the NexMind briefing session.");
  let selectedIds: string[];
  try {
    selectedIds = [...new Set([...(production.sourceId ? [production.sourceId] : []), ...sourceIdsFromUnknown(record(production.direction).sourceIds)])];
  } catch (error) {
    return problem(auth.id, 409, "INVALID_SOURCE_SELECTION", "Source selection is invalid", error instanceof Error ? error.message : "The production sources are invalid.");
  }
  let selectedSources;
  try { selectedSources = await ownedReadySources(production.ownerUserId, selectedIds); }
  catch (error) { return problem(auth.id, 409, "SOURCE_NOT_READY", "A production source is unavailable", error instanceof Error ? error.message : "A selected source cannot be used."); }
  const account = await prisma.user.findUnique({ where: { id: production.ownerUserId }, select: { displayName: true, handle: true, bio: true, location: true } });
  const groundedContext = {
    outcome: production.title,
    account,
    production: { id: production.id, kind: production.kind, title: production.title, status: production.status, direction: production.direction, brief: production.brief, source: production.source },
    userSupplied: parsed.data.context,
    sourceIds: selectedIds,
    sources: sourceMetadata(selectedSources),
    delegation: access.owner ? null : { workroomId: access.workroomId, delegateUserId: auth.session.userId, canApproveBrief: access.canApproveBrief, expiresAt: access.expiresAt },
    currentQuestion: null,
    partialTranscript: null,
  };
  const session = await prisma.$transaction(async (tx) => {
    if (production.status === "PAID") await tx.production.update({ where: { id }, data: { status: "LIVE_SESSION_READY" } });
    if (new Set(["PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(production.status)) await tx.production.update({ where: { id }, data: { status: "LIVE_SESSION_ACTIVE" } });
    return tx.liveSession.create({ data: { userId: auth.session.userId, productionId: id, purpose: "PRODUCTION_DIRECTION", state: "ACTIVE", context: groundedContext as never, startedAt: new Date() } });
  });
  return json(session, auth.id, { status: 201 });
}
