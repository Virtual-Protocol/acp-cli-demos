import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ title: z.string().trim().min(2).max(120).optional(), payload: z.record(z.string(), z.unknown()).optional() });
export async function PATCH(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params; const prisma = getPrisma()!;
  const draft = await prisma.draft.findFirst({ where: { id, ownerUserId: auth.session.userId } });
  if (!draft) return problem(auth.id, 404, "DRAFT_NOT_FOUND", "Draft not found", "The draft is unavailable.");
  return json(await prisma.draft.update({ where: { id }, data: { title: parsed.data.title, payload: parsed.data.payload as never } }), auth.id);
}
export async function DELETE(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const { id } = await context.params; const prisma = getPrisma()!;
  const result = await prisma.draft.deleteMany({ where: { id, ownerUserId: auth.session.userId } });
  return result.count ? json({ deleted: true, id }, auth.id) : problem(auth.id, 404, "DRAFT_NOT_FOUND", "Draft not found", "The draft is unavailable.");
}
