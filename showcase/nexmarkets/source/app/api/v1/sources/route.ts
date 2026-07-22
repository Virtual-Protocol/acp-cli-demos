import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { capturePublicPage } from "@/domain/source-security";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { encryptSecret } from "@/lib/secrets";
import { assertSafeUpload, canonicalUploadMime } from "@/domain/upload-security";
import { extractReadableUpload } from "@/domain/source-extraction";
import { consumeRateLimit } from "@/lib/rate-limit";
import { deleteObject, writeObject } from "@/lib/object-storage";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const jsonSchema = z.object({ workspaceId: z.string().uuid().optional(), name: z.string().trim().max(200).optional(), url: z.string().url().optional(), text: z.string().trim().min(2).max(200_000).optional(), isReusable: z.boolean().default(false), rightsAttested: z.literal(true) }).refine((value) => Boolean(value.url) !== Boolean(value.text), "Supply exactly one URL or text source.");

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const prisma = getPrisma()!;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const sources = await prisma.source.findMany({ where: { ownerUserId: auth.session.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0, take: 51 });
  const page = sources.slice(0, 50);
  return json({ items: page, nextCursor: sources.length > 50 ? page.at(-1)?.id ?? null : null }, auth.id);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const sourceLimit = await consumeRateLimit(auth.session.userId, "source_create", 30, 60 * 60_000);
  if (!sourceLimit.allowed) return problem(auth.id, 429, "SOURCE_RATE_LIMITED", "Too many sources", `Wait ${sourceLimit.retryAfterSeconds} seconds before adding another source.`);
  const prisma = getPrisma()!;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return problem(auth.id, 422, "FILE_REQUIRED", "File required", "Choose a file to upload.");
    if (form.get("rightsAttested") !== "true") return problem(auth.id, 422, "RIGHTS_ATTESTATION_REQUIRED", "Permission confirmation required", "Confirm that you are allowed to use this source before uploading it.");
    if (file.size > MAX_FILE_BYTES) return problem(auth.id, 413, "FILE_TOO_LARGE", "File is too large", "Upload a file no larger than 25 MB.");
    const workspaceId = typeof form.get("workspaceId") === "string" ? String(form.get("workspaceId")) || null : null;
    if (workspaceId) {
      const membership = await prisma.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId: auth.session.userId } } });
      if (!membership) return problem(auth.id, 403, "WORKSPACE_PERMISSION_REQUIRED", "Workspace permission required", "You cannot add sources to that workspace.");
    }
    const sourceId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160) || "upload";
    const objectKey = `${auth.session.userId}/${sourceId}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    try { await assertSafeUpload(file.name, file.type || "application/octet-stream", bytes); }
    catch (error) { return problem(auth.id, 422, "UNSAFE_UPLOAD", "File was not accepted", error instanceof Error ? error.message : "The upload did not pass security checks."); }
    try { await writeObject(objectKey, bytes, { contentType: canonicalUploadMime(file.name), exclusive: true }); }
    catch (error) { return problem(auth.id, 503, "OBJECT_STORAGE_UNAVAILABLE", "File storage is unavailable", error instanceof Error ? error.message : "The file could not be stored."); }
    const extension = path.extname(file.name).toLowerCase();
    let extractedText: string | null = null;
    try { extractedText = extractReadableUpload(file.name, bytes); }
    catch (error) {
      await deleteObject(objectKey).catch(() => null);
      return problem(auth.id, 422, "SOURCE_EXTRACTION_FAILED", "The document could not be read", error instanceof Error ? error.message : "The uploaded document structure is invalid.");
    }
    if ((extension === ".txt" || extension === ".csv") && !extractedText) {
      await deleteObject(objectKey).catch(() => null);
      return problem(auth.id, 422, "EMPTY_TEXT_SOURCE", "The text source is empty", "Upload a text or CSV file with readable content.");
    }
    const storedMimeType = canonicalUploadMime(file.name);
    let source;
    try { source = await prisma.source.create({ data: {
      id: sourceId, ownerUserId: auth.session.userId, workspaceId,
      name: file.name, kind: "FILE", objectKey, mimeType: storedMimeType, sizeBytes: BigInt(file.size),
      isReusable: form.get("isReusable") === "true", rights: { attestedByUser: form.get("rightsAttested") === "true", attestedAt: new Date().toISOString() },
      rawTextEncrypted: extractedText ? encryptSecret(extractedText) : null,
      extracted: extractedText ? { characters: extractedText.length, format: extension.slice(1), analysedAt: new Date().toISOString() } : { format: extension.slice(1), binaryAsset: true },
      contentHash: createHash("sha256").update(bytes).digest("hex"), status: "READY"
    } }); }
    catch (error) { await deleteObject(objectKey).catch(() => null); throw error; }
    return json(source, auth.id, { status: 201 });
  }

  const parsed = jsonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  if (parsed.data.workspaceId) {
    const membership = await prisma.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: auth.session.userId } } });
    if (!membership) return problem(auth.id, 403, "WORKSPACE_PERMISSION_REQUIRED", "Workspace permission required", "You cannot add sources to that workspace.");
  }
  let captured: Awaited<ReturnType<typeof capturePublicPage>> | null = null;
  if (parsed.data.url) {
    try { captured = await capturePublicPage(parsed.data.url); }
    catch (error) { return problem(auth.id, 422, "SOURCE_ANALYSIS_FAILED", "Source could not be analysed", error instanceof Error ? error.message : "The source could not be read."); }
  }
  const content = captured?.text || parsed.data.text!;
  const source = await prisma.source.create({ data: {
    ownerUserId: auth.session.userId, workspaceId: parsed.data.workspaceId, name: parsed.data.name || captured?.title || (parsed.data.url ? new URL(parsed.data.url).hostname : "Text source"),
    kind: parsed.data.url ? "WEBSITE" : "TEXT", originalUrl: parsed.data.url, rawTextEncrypted: encryptSecret(content),
    isReusable: parsed.data.isReusable, rights: { attestedByUser: true, attestedAt: new Date().toISOString() },
    contentHash: createHash("sha256").update(content).digest("hex"), status: "READY",
    extracted: captured
      ? { title: captured.title, finalUrl: captured.finalUrl, characters: content.length, analysedAt: new Date().toISOString() }
      : { characters: content.length }
  } });
  return json(source, auth.id, { status: 201 });
}
