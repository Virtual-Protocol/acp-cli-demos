import { getPrisma } from "@/lib/db";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/route-auth";
export const runtime = "nodejs";
export async function GET(request: Request) { const auth = await requireSession(request); if (auth.response) return auth.response; return json(await getPrisma()!.reputationProfile.findFirst({ where: { userId: auth.session.userId }, include: { evidence: true }, orderBy: { updatedAt: "desc" } }), auth.id); }
