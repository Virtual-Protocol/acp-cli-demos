import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { serialize } from "@/lib/http";

export const runtime = "nodejs";
const schema = z.object({ displayName: z.string().trim().min(2).max(100).optional(), handle: z.string().trim().regex(/^[a-zA-Z0-9_]{2,30}$/).optional(), bio: z.string().trim().max(500).nullable().optional(), location: z.string().trim().max(120).nullable().optional(), theme: z.enum(["dark", "light"]).optional(), settings: z.record(z.string(), z.unknown()).optional() });
export async function PATCH(request: Request) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  try { return json(await getPrisma()!.user.update({ where: { id: auth.session.userId }, data: { ...parsed.data, settings: parsed.data.settings ? serialize(parsed.data.settings) as never : undefined } }), auth.id); }
  catch (error) { return problem(auth.id, 409, "ACCOUNT_UPDATE_FAILED", "Account could not be updated", error instanceof Error ? error.message : "The account update failed."); }
}
