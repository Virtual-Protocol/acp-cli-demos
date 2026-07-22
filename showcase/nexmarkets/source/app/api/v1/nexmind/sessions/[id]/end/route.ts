import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({ where: { id, userId: auth.session.userId } });
  if (!session) return problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "The session is unavailable.");
  if (new Set(["ENDED", "APPROVED"]).has(session.state)) return json(session, auth.id);
  const updated = await prisma.$transaction(async (tx) => {
    if (session.productionId) {
      const production = await tx.production.findUnique({ where: { id: session.productionId }, select: { status: true } });
      if (production?.status === "LIVE_SESSION_ACTIVE") await tx.production.update({ where: { id: session.productionId }, data: { status: "LIVE_SESSION_READY" } });
    }
    if (session.reputationProfileId) {
      const profile = await tx.reputationProfile.findUnique({ where: { id: session.reputationProfileId }, select: { status: true } });
      if (profile?.status === "LIVE_ACTIVE") await tx.reputationProfile.update({ where: { id: session.reputationProfileId }, data: { status: "ENHANCEMENT_ELIGIBLE" } });
    }
    return tx.liveSession.update({ where: { id }, data: { state: "ENDED", endedAt: new Date(), context: { ...record(session.context), partialTranscript: null, liveState: "idle" } as never } });
  });
  return json(updated, auth.id);
}
