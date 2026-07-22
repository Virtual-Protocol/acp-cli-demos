import path from "node:path";
import { getPrisma } from "@/lib/db";
import { problem } from "@/lib/http";
import { readObject } from "@/lib/production-artifacts";
import { record } from "@/lib/product-view";
import { requireSession } from "@/lib/route-auth";
import { requireProductionCapability } from "@/lib/production-access";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function outputType(objectKey: string, manifest: unknown) {
  const declared = record(manifest).outputMimeType;
  if (typeof declared === "string" && /^(video|image)\//.test(declared)) return declared;
  const extension = path.extname(objectKey).toLowerCase();
  return extension === ".png" ? "image/png" : extension === ".webm" ? "video/webm" : "video/mp4";
}

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const access = await requireProductionCapability(auth.session.userId, id, "view");
  const production = access ? await getPrisma()!.production.findFirst({
    where: { id },
    include: { currentVersion: true }
  }) : null;
  const version = production?.currentVersion;
  if (!production || !version?.outputObjectKey) {
    return problem(auth.id, 404, "PRODUCTION_OUTPUT_NOT_FOUND", "Production output not found", "This production does not have a persisted output yet.");
  }
  const bytes = await readObject(version.outputObjectKey).catch(() => null);
  if (!bytes) return problem(auth.id, 404, "PRODUCTION_OUTPUT_MISSING", "Production output is unavailable", "The persisted artifact could not be read.");
  const contentType = outputType(version.outputObjectKey, version.manifest);
  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const extension = path.extname(version.outputObjectKey) || (contentType === "image/png" ? ".png" : ".mp4");
  const filename = `${production.title.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "nexmarkets-output"}-v${version.versionNumber}${extension}`;
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
