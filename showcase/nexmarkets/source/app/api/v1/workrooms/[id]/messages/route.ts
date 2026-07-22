import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ body: z.string().trim().min(1).max(10_000), attachments: z.array(z.string().uuid()).max(20).default([]) });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }] } });
  if (!room) return problem(auth.id, 404, "WORKROOM_NOT_FOUND", "Workroom not found", "You are not a participant in this Workroom.");
  const recipient = room.founderUserId === auth.session.userId ? room.workerUserId : room.founderUserId;
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.workroomMessage.create({ data: { workroomId: id, authorId: auth.session.userId, body: parsed.data.body, attachments: parsed.data.attachments }, include: { author: true } });
    await createNotification(tx, { userId: recipient, kind: "WORKROOM_MESSAGE", title: "New Workroom message", body: parsed.data.body.slice(0, 180), deepLink: `/workrooms/${id}?tab=messages` });
    return created;
  });
  return json(message, auth.id, { status: 201 });
}
