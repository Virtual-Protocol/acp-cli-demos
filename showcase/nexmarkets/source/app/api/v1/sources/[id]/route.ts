import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { deleteObject } from "@/lib/object-storage";
import { strings } from "@/lib/product-view";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const source = await getPrisma()!.source.findFirst({ where: { id, ownerUserId: auth.session.userId } });
  return source ? json(source, auth.id) : problem(auth.id, 404, "SOURCE_NOT_FOUND", "Source not found", "The source does not exist in this account.");
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const source = await prisma.source.findFirst({ where: { id, ownerUserId: auth.session.userId }, include: { productions: { select: { id: true } } } });
  if (!source) return problem(auth.id, 404, "SOURCE_NOT_FOUND", "Source not found", "The source does not exist in this account.");
  if (source.productions.length) return problem(auth.id, 409, "SOURCE_IN_USE", "Source is in use", "Remove it from active productions before deleting its reusable record.");
  const [directionProductions, deliveries, messages] = await Promise.all([
    prisma.production.findMany({ where: { ownerUserId: auth.session.userId }, select: { id: true, direction: true } }),
    source.objectKey ? prisma.workroomDelivery.findMany({ where: { submittedById: auth.session.userId }, select: { objectKeys: true } }) : Promise.resolve([]),
    prisma.workroomMessage.findMany({ where: { authorId: auth.session.userId }, select: { attachments: true } })
  ]);
  if (directionProductions.some((production) => strings((production.direction as { sourceIds?: unknown }).sourceIds).includes(source.id))) {
    return problem(auth.id, 409, "SOURCE_IN_USE", "Source is in use", "Remove this source from the saved Studio direction before deleting its reusable record.");
  }
  if ((source.objectKey && deliveries.some((delivery) => strings(delivery.objectKeys).includes(source.objectKey!))) || messages.some((message) => strings(message.attachments).includes(source.id))) {
    return problem(auth.id, 409, "SOURCE_IN_USE", "Source is in use", "This file is attached to a Workroom record and cannot be deleted.");
  }
  await prisma.source.delete({ where: { id } });
  if (source.objectKey) await deleteObject(source.objectKey).catch(() => null);
  return json({ deleted: true, id }, auth.id);
}
