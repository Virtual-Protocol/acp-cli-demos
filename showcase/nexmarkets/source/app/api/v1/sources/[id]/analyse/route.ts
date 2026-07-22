import { createHash } from "node:crypto";
import { capturePublicPage } from "@/domain/source-security";
import { getPrisma } from "@/lib/db";
import { json, problem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { encryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const source = await prisma.source.findFirst({ where: { id, ownerUserId: auth.session.userId } });
  if (!source?.originalUrl) return problem(auth.id, 409, "URL_SOURCE_REQUIRED", "URL source required", "Only a URL source needs remote analysis.");
  try {
    await prisma.source.update({ where: { id }, data: { status: "ANALYSING" } });
    const captured = await capturePublicPage(source.originalUrl);
    const updated = await prisma.source.update({ where: { id }, data: {
      status: "READY", rawTextEncrypted: encryptSecret(captured.text), contentHash: createHash("sha256").update(captured.text).digest("hex"),
      extracted: { title: captured.title || source.name, finalUrl: captured.finalUrl, characters: captured.text.length, analysedAt: new Date().toISOString() }
    } });
    return json(updated, auth.id);
  } catch (error) {
    await prisma.source.update({ where: { id }, data: { status: "FAILED", extracted: { error: error instanceof Error ? error.message : "Source analysis failed." } } });
    return problem(auth.id, 422, "SOURCE_ANALYSIS_FAILED", "Source could not be analysed", error instanceof Error ? error.message : "The source could not be read.");
  }
}
