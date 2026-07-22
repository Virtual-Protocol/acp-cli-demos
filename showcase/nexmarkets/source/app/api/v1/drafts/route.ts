import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
const schema = z.object({ workspaceId: z.string().uuid().optional(), kind: z.enum(["VIDEO", "INFOGRAPHIC"]), title: z.string().trim().min(2).max(120), payload: z.record(z.string(), z.unknown()).default({}) });
export async function GET(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const items = await getPrisma()!.draft.findMany({ where: { ownerUserId: auth.session.userId }, orderBy: { updatedAt: "desc" }, take: 50 });
  return json({ items }, auth.id);
}
export async function POST(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const draft = await getPrisma()!.draft.create({ data: { ownerUserId: auth.session.userId, ...parsed.data, payload: parsed.data.payload as never } });
  return json(draft, auth.id, { status: 201 });
}
