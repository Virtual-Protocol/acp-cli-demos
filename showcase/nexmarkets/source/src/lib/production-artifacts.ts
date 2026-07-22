import { createHash, randomUUID } from "node:crypto";
import { fetchPublicBytes } from "@/domain/source-security";
import type { CompositionBundle } from "@/hyperframes/types";
import { getPrisma } from "./db";
import { writeObject } from "./object-storage";
import { record } from "./product-view";

export { readObject } from "./object-storage";

async function nextVersion(productionId: string) {
  const aggregate = await getPrisma()!.productionVersion.aggregate({ where: { productionId }, _max: { versionNumber: true } });
  return (aggregate._max.versionNumber ?? 0) + 1;
}

export async function saveCompositionVersion(productionId: string, bundle: CompositionBundle) {
  const versionNumber = await nextVersion(productionId);
  const versionId = randomUUID();
  const base = `productions/${productionId}/versions/${versionNumber}/composition`;
  for (const [name, value] of Object.entries(bundle.files)) await writeObject(`${base}/${name}`, value);
  const manifestKey = `${base}/manifest.json`;
  await writeObject(manifestKey, JSON.stringify(bundle.manifest, null, 2));
  return getPrisma()!.productionVersion.create({
    data: { id: versionId, productionId, versionNumber, compositionObjectKey: manifestKey, manifest: bundle.manifest as never, sourceHash: bundle.manifest.sourceHash },
  });
}

export async function saveInfographicVersion(productionId: string, png: Uint8Array, input: { width: number; height: number; sourceHash: string }) {
  const versionNumber = await nextVersion(productionId);
  const versionId = randomUUID();
  const outputObjectKey = `productions/${productionId}/versions/${versionNumber}/output.png`;
  await writeObject(outputObjectKey, png);
  const manifest = { kind: "INFOGRAPHIC", width: input.width, height: input.height, mimeType: "image/png", outputHash: input.sourceHash, createdAt: new Date().toISOString() };
  return getPrisma()!.$transaction(async (tx) => {
    const version = await tx.productionVersion.create({ data: { id: versionId, productionId, versionNumber, outputObjectKey, previewObjectKey: outputObjectKey, manifest, sourceHash: input.sourceHash } });
    await tx.production.update({ where: { id: productionId }, data: { currentVersionId: version.id } });
    return version;
  });
}

export async function completeDevSimulatedVideoVersion(productionId: string, versionId: string) {
  const prisma = getPrisma()!;
  const version = await prisma.productionVersion.findFirst({ where: { id: versionId, productionId } });
  if (!version) throw new Error("The render job does not reference a valid production version.");
  const base = `productions/${productionId}/versions/${version.versionNumber}`;
  const outputBytes = Buffer.from(
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAAGG1kYXQAAAGzbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAFx0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAEAAAAAAAEAAAAAABx1ZHRhAAAAGW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAALGlsc3Q=",
    "base64"
  );
  const outputHash = createHash("sha256").update(outputBytes).digest("hex");
  const outputObjectKey = await writeObject(`${base}/output-dev-simulated.mp4`, outputBytes, { contentType: "video/mp4" });
  const manifest = { ...record(version.manifest), outputHash, outputMimeType: "video/mp4", simulated: true, completedAt: new Date().toISOString() };
  return prisma.$transaction(async (tx) => {
    const completed = await tx.productionVersion.update({ where: { id: version.id }, data: { outputObjectKey, previewObjectKey: outputObjectKey, manifest } });
    await tx.production.update({ where: { id: productionId }, data: { currentVersionId: version.id } });
    return completed;
  });
}

async function remoteBinary(url: string, maximumBytes: number, expected: "video" | "image") {
  const resource = await fetchPublicBytes(url, { maximumBytes, acceptedContentTypes: [`${expected}/*`], timeoutMs: 120_000, userAgent: "NexMarketsProviderOutput/1.0" });
  return { bytes: resource.bytes, contentType: resource.contentType, hash: createHash("sha256").update(resource.bytes).digest("hex") };
}

export async function completeVideoVersion(productionId: string, versionId: string, videoUrl: string, thumbnailUrl?: string) {
  const prisma = getPrisma()!;
  const version = await prisma.productionVersion.findFirst({ where: { id: versionId, productionId } });
  if (!version) throw new Error("The render job does not reference a valid production version.");
  const video = await remoteBinary(videoUrl, 500 * 1024 * 1024, "video");
  const base = `productions/${productionId}/versions/${version.versionNumber}`;
  const extension = video.contentType === "video/webm" ? "webm" : "mp4";
  const outputObjectKey = await writeObject(`${base}/output.${extension}`, video.bytes);
  let thumbnailObjectKey: string | undefined;
  let thumbnailHash: string | undefined;
  if (thumbnailUrl) {
    try {
      const thumbnail = await remoteBinary(thumbnailUrl, 20 * 1024 * 1024, "image");
      const imageExtension = thumbnail.contentType === "image/png" ? "png" : "jpg";
      thumbnailObjectKey = await writeObject(`${base}/thumbnail.${imageExtension}`, thumbnail.bytes);
      thumbnailHash = thumbnail.hash;
    } catch (error) {
      console.warn("Failed to download video thumbnail, continuing without it:", error);
    }
  }
  const manifest = { ...record(version.manifest), outputHash: video.hash, outputMimeType: video.contentType, thumbnailHash, completedAt: new Date().toISOString() };
  return prisma.$transaction(async (tx) => {
    const completed = await tx.productionVersion.update({ where: { id: version.id }, data: { outputObjectKey, previewObjectKey: outputObjectKey, thumbnailObjectKey, manifest } });
    await tx.production.update({ where: { id: productionId }, data: { currentVersionId: version.id } });
    return completed;
  });
}
