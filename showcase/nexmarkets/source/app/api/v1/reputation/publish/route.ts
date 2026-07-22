import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("base") }),
  z.object({ mode: z.literal("enhanced"), fields: z.object({ role: z.string().max(120).default(""), workLine: z.string().min(2).max(500), areas: z.string().max(500).default(""), availability: z.string().max(200).default(""), location: z.string().max(120).default(""), northstar: z.string().max(500).default("") }), visibility: z.record(z.string(), z.boolean()) })
]);
export async function POST(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const prisma = getPrisma()!; const profile = await prisma.reputationProfile.findFirst({ where: { userId: auth.session.userId }, orderBy: { updatedAt: "desc" } });
  if (!profile || !new Set(["BASE_CARD_READY", "ENHANCEMENT_ELIGIBLE", "PROFILE_REVIEW", "ENHANCED_CARD_READY"]).has(profile.status)) return problem(auth.id, 409, "REPUTATION_NOT_READY", "NexCard is not ready", "Connect X and finish the base analysis first.");
  const updated = parsed.data.mode === "base"
    ? await prisma.reputationProfile.update({ where: { id: profile.id }, data: { publicSettings: { visibility: {}, published: true, publishedAt: new Date().toISOString() }, currentCardVersion: { increment: 1 }, pausedAt: null } })
    : await prisma.reputationProfile.update({ where: { id: profile.id }, data: { status: "ENHANCED_CARD_READY", enhancedProfile: parsed.data.fields, publicSettings: { visibility: parsed.data.visibility, published: true, publishedAt: new Date().toISOString() }, currentCardVersion: { increment: 1 }, pausedAt: null } });
  return json(updated, auth.id);
}
