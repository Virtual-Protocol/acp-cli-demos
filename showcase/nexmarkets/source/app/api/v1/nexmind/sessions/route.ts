import { z } from "zod";
import { walletSnapshot } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { NEX_THRESHOLD_ATOMIC } from "@/domain/pricing";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { nexMindPurposes, record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { ownedReadySources, sourceIdsFromUnknown, sourceMetadata } from "@/lib/source-grounding";
import { requireProductionCapability } from "@/lib/production-access";

export const runtime = "nodejs";

const schema = z.object({
  purpose: z.enum(nexMindPurposes),
  productionId: z.string().uuid().optional(),
  reputationProfileId: z.string().uuid().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const sessions = await getPrisma()!.liveSession.findMany({
    where: { userId: auth.session.userId },
    include: {
      messages: { orderBy: { sequence: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return json({
    configured: Boolean(env.nexmindApiUrl && env.nexmindApiKey),
    items: sessions.map((session) => {
      const context = record(session.context);
      const proposal = record(context.proposal);
      return {
        id: session.id,
        purpose: session.purpose,
        state: session.state,
        productionId: session.productionId,
        reputationProfileId: session.reputationProfileId,
        title: typeof proposal.title === "string" ? proposal.title : typeof context.outcome === "string" ? context.outcome : null,
        messageCount: session._count.messages,
        lastMessage: session.messages[0]?.text || null,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        updatedAt: session.updatedAt,
      };
    }),
  }, auth.id);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!env.nexmindApiUrl || !env.nexmindApiKey) {
    return problem(auth.id, 503, "NEXMIND_NOT_CONFIGURED", "NexMind is unavailable", "Configure the NexMind provider endpoint and key before starting a session.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  if (JSON.stringify(parsed.data.context).length > 50_000) {
    return problem(auth.id, 413, "NEXMIND_CONTEXT_TOO_LARGE", "Context is too large", "Attach Project Vault sources by identifier instead of placing full files in the request.");
  }
  const prisma = getPrisma()!;
  if (parsed.data.productionId && !(await requireProductionCapability(auth.session.userId, parsed.data.productionId, "brief"))) {
    return problem(auth.id, 403, "PRODUCTION_BRIEF_PERMISSION_REQUIRED", "Briefing permission required", "Only the production owner or an active delegated Workroom participant can start this session.");
  }
  const production = parsed.data.productionId ? await prisma.production.findFirst({
    where: { id: parsed.data.productionId },
    select: { id: true, ownerUserId: true, kind: true, title: true, status: true, direction: true, brief: true, source: { select: { id: true, name: true, kind: true, extracted: true, status: true, rights: true } } },
  }) : null;
  if (parsed.data.productionId && !production) return problem(auth.id, 404, "PRODUCTION_NOT_FOUND", "Production not found", "The production is unavailable.");
  const reputation = parsed.data.reputationProfileId ? await prisma.reputationProfile.findFirst({
    where: { id: parsed.data.reputationProfileId, userId: auth.session.userId },
    select: { id: true, handle: true, status: true, baseProfile: true, enhancedProfile: true, publicSettings: true, evidence: { where: { status: "VERIFIED" }, select: { id: true, sourceType: true, sourceUrl: true, sourceDate: true, excerpt: true, supports: true, visibility: true, confidence: true } } },
  }) : null;
  if (parsed.data.reputationProfileId && !reputation) return problem(auth.id, 404, "REPUTATION_NOT_FOUND", "Reputation profile not found", "The profile is unavailable.");
  if (parsed.data.purpose === "REPUTATION_ENHANCEMENT" && !reputation) return problem(auth.id, 422, "REPUTATION_CONTEXT_REQUIRED", "NexCard context required", "Start reputation enhancement from an existing base NexCard.");
  if (parsed.data.purpose === "REPUTATION_ENHANCEMENT") {
    const wallet = auth.session.user.wallets.find((item) => item.isPrimary) ?? auth.session.user.wallets[0];
    if (!wallet) return problem(auth.id, 403, "NEX_HOLDER_ACCESS_REQUIRED", "$NEX holder access required", "Connect the wallet that holds at least 50,000 $NEX.");
    let snapshot;
    try { snapshot = await walletSnapshot(wallet.address as `0x${string}`); }
    catch (error) { return problem(auth.id, 503, "NEX_BALANCE_UNAVAILABLE", "$NEX balance is unavailable", error instanceof Error ? error.message : "The Robinhood Chain balance could not be verified."); }
    if (!snapshot.configured || snapshot.nexAtomic == null) return problem(auth.id, 503, "NEX_BALANCE_UNAVAILABLE", "$NEX balance is unavailable", "Configure Robinhood Chain and the official $NEX contract before checking holder access.");
    if (snapshot.nexAtomic < NEX_THRESHOLD_ATOMIC) return problem(auth.id, 403, "NEX_HOLDER_ACCESS_REQUIRED", "$NEX holder access required", "The connected wallet must hold at least 50,000 $NEX. Tokens remain in the wallet.");
  }

  const supplied = parsed.data.context;
  let sourceIds: string[];
  try {
    sourceIds = sourceIdsFromUnknown(supplied.sourceIds);
    if (production?.source?.id) sourceIds.push(production.source.id);
    for (const sourceId of sourceIdsFromUnknown(record(production?.direction).sourceIds)) sourceIds.push(sourceId);
    sourceIds = [...new Set(sourceIds)];
  } catch (error) {
    return problem(auth.id, 422, "INVALID_SOURCE_SELECTION", "Source selection is invalid", error instanceof Error ? error.message : "The selected source identifiers are invalid.");
  }
  let selectedSources;
  try { selectedSources = await ownedReadySources(production?.ownerUserId || auth.session.userId, sourceIds); }
  catch (error) { return problem(auth.id, 409, "SOURCE_NOT_READY", "A selected source is unavailable", error instanceof Error ? error.message : "A selected source cannot be used."); }
  const account = await prisma.user.findUnique({
    where: { id: production?.ownerUserId || auth.session.userId },
    select: { displayName: true, handle: true, bio: true, location: true },
  });
  const groundedContext = {
    outcome: typeof supplied.outcome === "string" ? supplied.outcome.slice(0, 8_000) : null,
    route: typeof supplied.route === "string" ? supplied.route.slice(0, 80) : null,
    userSupplied: supplied,
    account,
    production,
    reputation,
    sourceIds,
    sources: sourceMetadata(selectedSources),
    currentQuestion: null,
    partialTranscript: null,
    confirmedAt: null,
  };
  const sessionData = {
      userId: auth.session.userId,
      purpose: parsed.data.purpose,
      productionId: parsed.data.productionId,
      reputationProfileId: parsed.data.reputationProfileId,
      state: "ACTIVE",
      context: groundedContext as never,
      startedAt: new Date(),
  };
  const session = await prisma.$transaction(async (tx) => {
    if (reputation) await tx.reputationProfile.update({ where: { id: reputation.id }, data: { status: "LIVE_ACTIVE" } });
    if (production?.status === "PAID") {
      await tx.production.update({ where: { id: production.id }, data: { status: "LIVE_SESSION_READY" } });
      await tx.production.update({ where: { id: production.id }, data: { status: "LIVE_SESSION_ACTIVE" } });
    } else if (production && new Set(["LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(production.status)) {
      await tx.production.update({ where: { id: production.id }, data: { status: "LIVE_SESSION_ACTIVE" } });
    }
    return tx.liveSession.create({ data: sessionData });
  });
  return json(session, auth.id, { status: 201 });
}
