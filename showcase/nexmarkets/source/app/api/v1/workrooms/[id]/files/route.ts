import path from "node:path";
import { getPrisma } from "@/lib/db";
import { problem } from "@/lib/http";
import { readObject } from "@/lib/production-artifacts";
import { strings } from "@/lib/product-view";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const objectKey = new URL(request.url).searchParams.get("key")?.trim();
  if (!objectKey) return problem(auth.id, 422, "DELIVERY_FILE_REQUIRED", "Delivery file is required", "Choose a file attached to this Workroom.");
  const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({
    where: { id, OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }] },
    include: { deliveries: { select: { objectKeys: true } } }
  });
  if (!room || !room.deliveries.some((delivery) => strings(delivery.objectKeys).includes(objectKey))) {
    return problem(auth.id, 404, "DELIVERY_FILE_NOT_FOUND", "Delivery file not found", "This file is not attached to a delivery in your Workroom.");
  }
  const source = await prisma.source.findFirst({ where: { objectKey, ownerUserId: { in: [room.founderUserId, room.workerUserId] } } });
  if (!source?.objectKey) return problem(auth.id, 404, "DELIVERY_FILE_NOT_FOUND", "Delivery file not found", "The source record for this delivery is unavailable.");
  const bytes = await readObject(source.objectKey).catch(() => null);
  if (!bytes) return problem(auth.id, 404, "DELIVERY_FILE_MISSING", "Delivery file is unavailable", "The persisted file bytes could not be read.");
  const filename = source.name || path.basename(source.objectKey);
  return new Response(bytes, { headers: {
    "content-type": source.mimeType || "application/octet-stream",
    "content-length": String(bytes.byteLength),
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff"
  } });
}
