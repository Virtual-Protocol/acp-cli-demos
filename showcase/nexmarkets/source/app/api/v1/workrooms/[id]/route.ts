import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const workroom = await getPrisma()!.workroom.findFirst({
    where: { id, OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }] },
    include: { listing: true, founder: true, worker: true, messages: { include: { author: true }, orderBy: { createdAt: "asc" } }, deliveries: { orderBy: { version: "desc" } }, revisions: { orderBy: { createdAt: "desc" } }, disputes: { orderBy: { createdAt: "desc" } } }
  });
  return workroom ? json(workroom, auth.id) : problem(auth.id, 404, "WORKROOM_NOT_FOUND", "Workroom not found", "You are not a participant in this Workroom.");
}
