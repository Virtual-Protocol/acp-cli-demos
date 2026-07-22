import { getPrisma } from "@/lib/db";
import { problem } from "@/lib/http";
import { readObject } from "@/lib/object-storage";
import { requireSession } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const source = await getPrisma()!.source.findFirst({ where: { id, ownerUserId: auth.session.userId } });
  if (!source?.objectKey) return problem(auth.id, 404, "SOURCE_CONTENT_NOT_FOUND", "File content not found", "This source does not have stored file content.");
  const bytes = await readObject(source.objectKey).catch(() => null);
  if (!bytes) return problem(auth.id, 404, "SOURCE_CONTENT_NOT_FOUND", "File content not found", "The stored file is unavailable.");
  return new Response(bytes, { headers: { "content-type": source.mimeType || "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(source.name || "source")}`, "cache-control": "private, no-store" } });
}
