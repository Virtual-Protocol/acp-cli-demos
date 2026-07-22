import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, requestId } from "@/lib/http";
import { analyseXHandleWithNexMind, normaliseXHandle } from "@/lib/reputation-inference";
import { getReputationSession } from "@/lib/reputation-session";
import { requireTrustedOrigin } from "@/lib/route-auth";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function slug(handle: string, suffix: string) {
  return `${handle.toLowerCase()}-${suffix}`.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const id = requestId(request);
  const originError = requireTrustedOrigin(request, id); if (originError) return originError;
  const prisma = getPrisma();
  if (!prisma) return problem(id, 503, "DATABASE_REQUIRED", "Persistent data unavailable", "NexMarkets needs Prisma persistence for reputation profiles.");

  const session = await getSession(request);
  const reputationSession = session ? null : await getReputationSession(request);
  const userId = session?.userId || reputationSession?.userId;
  const account = session?.user.xAccounts[0] || reputationSession?.xAccount || null;
  if (!userId || !account) return problem(id, 409, "X_CONNECTION_REQUIRED", "Connect X first", "Connect your X account before NexMind builds the NexCard.", [{ label: "Connect X", href: "/api/v1/x/connect" }]);

  const handle = normaliseXHandle(account.handle);

  try {
    const result = env.reputationNexmindApiUrl && env.reputationNexmindApiKey ? await analyseXHandleWithNexMind(handle) : null;
    if (!result) return problem(id, 503, "NEXMIND_NOT_CONFIGURED", "NexMind reputation analysis is unavailable", "Configure the Virtuals inference endpoint and key before generating NexCards in production.");

    const refreshedAt = new Date(result.analysis.analysedAt);
    const baseProfile = { identity: result.identity, analysis: result.analysis, nexCardModel: { identity: { name: result.identity.name, handle: result.identity.username, avatarUrl: result.identity.profile_image_url, headline: result.analysis.workSignature, location: result.identity.location }, workSignature: result.analysis.workSignature, capabilities: result.analysis.capabilities, selectedWork: result.analysis.selectedWork, activity: result.analysis.activity, network: result.analysis.network, desiredWork: result.analysis.desiredWork, availability: result.analysis.availability, enhanced: false, updatedAt: result.analysis.analysedAt } };
    const existing = await prisma.reputationProfile.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
    const profile = existing
      ? await prisma.reputationProfile.update({ where: { id: existing.id }, data: { handle, status: existing.status === "ENHANCED_CARD_READY" ? "ENHANCED_CARD_READY" : "BASE_CARD_READY", baseProfile, publicSettings: { published: true, visibility: {}, publishedAt: result.analysis.analysedAt }, lastXRefreshAt: refreshedAt, pausedAt: null, currentCardVersion: { increment: 1 } } })
      : await prisma.reputationProfile.create({ data: { userId, handle, status: "BASE_CARD_READY", baseProfile, publicSlug: slug(handle, userId.slice(0, 8)), publicSettings: { published: true, visibility: {}, publishedAt: result.analysis.analysedAt }, lastXRefreshAt: refreshedAt } });
    await prisma.reputationEvidence.deleteMany({ where: { profileId: profile.id, sourceType: "X_POST" } });
    if (result.analysis.standout.length) await prisma.reputationEvidence.createMany({ data: result.analysis.standout.map((post) => ({ profileId: profile.id, sourceType: "X_POST", sourceUrl: post.url || `https://x.com/${handle}`, sourceDate: post.createdAt ? new Date(post.createdAt) : null, excerpt: post.text.slice(0, 500), supports: { metrics: post.metrics, collector: "nexmind" }, confidence: 80, status: "VERIFIED" })) });
    const saved = await prisma.reputationProfile.findUnique({ where: { id: profile.id }, include: { evidence: true } });
    return json(saved, id);
  } catch (error) {
    return problem(id, 502, "NEXMIND_ANALYSIS_FAILED", "NexMind analysis could not complete", error instanceof Error ? error.message : "The connected X account could not be analysed.");
  }
}