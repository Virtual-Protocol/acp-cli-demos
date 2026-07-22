import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const { id } = await context.params; const prisma = getPrisma()!;
  const item = await prisma.notification.findFirst({ where: { id, userId: auth.session.userId } });
  if (!item) return problem(auth.id, 404, "NOTIFICATION_NOT_FOUND", "Notification not found", "The notification is unavailable.");
  return json(await prisma.notification.update({ where: { id }, data: { readAt: new Date() } }), auth.id);
}
