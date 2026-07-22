import { getPrisma } from "./db";
import { record } from "./nexmind";
import { readObject } from "./object-storage";
import { decryptSecret } from "./secrets";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sourceIdsFromUnknown(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Selected source identifiers must be an array.");
  const ids = [...new Set(value.map((item) => {
    if (typeof item !== "string" || !uuidPattern.test(item)) throw new Error("A selected source identifier is invalid.");
    return item;
  }))];
  if (ids.length > 20) throw new Error("Choose no more than 20 sources for one outcome.");
  return ids;
}

function rightsAttested(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).attestedByUser === true);
}

export async function ownedReadySources(userId: string, sourceIds: string[]) {
  const ids = [...new Set(sourceIds)];
  if (!ids.length) return [];
  const sources = await getPrisma()!.source.findMany({
    where: { id: { in: ids }, ownerUserId: userId, status: "READY" },
    select: {
      id: true, name: true, kind: true, originalUrl: true, objectKey: true, mimeType: true,
      sizeBytes: true, rawTextEncrypted: true, extracted: true, rights: true, contentHash: true,
    },
  });
  if (sources.length !== ids.length) throw new Error("Every selected source must belong to you and be ready for use.");
  if (sources.some((source) => !rightsAttested(source.rights))) throw new Error("Every selected source requires a rights attestation.");
  const order = new Map(ids.map((id, index) => [id, index]));
  return sources.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export function sourceMetadata(sources: Awaited<ReturnType<typeof ownedReadySources>>) {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    originalUrl: source.originalUrl,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
    extracted: source.extracted,
    rights: source.rights,
    contentHash: source.contentHash,
  }));
}

export async function groundedSources(userId: string, sourceIds: string[]) {
  const sources = await ownedReadySources(userId, sourceIds);
  let remaining = 48_000;
  return sources.map((source) => {
    const decrypted = source.rawTextEncrypted ? decryptSecret(source.rawTextEncrypted) : null;
    const content = decrypted && remaining > 0 ? decrypted.slice(0, Math.min(16_000, remaining)) : null;
    remaining -= content?.length ?? 0;
    return {
      id: source.id,
      name: source.name,
      kind: source.kind,
      originalUrl: source.originalUrl,
      mimeType: source.mimeType,
      extracted: source.extracted,
      rights: source.rights,
      contentHash: source.contentHash,
      content,
      contentTruncated: Boolean(decrypted && content && content.length < decrypted.length),
    };
  });
}

function idsFromDescriptors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = record(item).id;
    return typeof id === "string" && uuidPattern.test(id) ? [id] : [];
  });
}

export async function groundedSessionContext(userId: string, context: unknown, productionId?: string | null) {
  const stored = record(context);
  const supplied = record(stored.userSupplied);
  const ids = new Set<string>([
    ...sourceIdsFromUnknown(stored.sourceIds),
    ...sourceIdsFromUnknown(supplied.sourceIds),
    ...idsFromDescriptors(stored.sources),
  ]);
  let production: { sourceId: string | null; direction: unknown; ownerUserId: string } | null = null;
  let sourceOwnerUserId = userId;
  if (productionId) {
    production = await getPrisma()!.production.findUnique({ where: { id: productionId }, select: { sourceId: true, direction: true, ownerUserId: true } });
    if (!production) throw new Error("The session production is unavailable.");
    sourceOwnerUserId = production.ownerUserId;
    if (production.sourceId) ids.add(production.sourceId);
    for (const id of sourceIdsFromUnknown(record(production.direction).sourceIds)) ids.add(id);
  }
  const sources = await groundedSources(sourceOwnerUserId, [...ids]);
  return { ...stored, sourceIds: [...ids], sources };
}

export type GroundedImageAsset = {
  sourceId: string;
  name: string;
  mimeType: string;
  contentHash: string;
  bytes: Uint8Array;
};

export async function productionImageAssets(userId: string, sourceIds: string[]) {
  const sources = await ownedReadySources(userId, sourceIds);
  const candidates = sources.filter((source) => source.objectKey && source.mimeType?.startsWith("image/"));
  const assets: GroundedImageAsset[] = [];
  let total = 0;
  for (const source of candidates.slice(0, 5)) {
    const bytes = new Uint8Array(await readObject(source.objectKey!));
    if (bytes.byteLength > 10 * 1024 * 1024 || total + bytes.byteLength > 20 * 1024 * 1024) continue;
    total += bytes.byteLength;
    assets.push({ sourceId: source.id, name: source.name || `source-${source.id}`, mimeType: source.mimeType!, contentHash: source.contentHash, bytes });
  }
  return assets;
}
