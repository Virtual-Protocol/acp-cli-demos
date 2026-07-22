import { createHash } from "node:crypto";
import type { ProductionKind, ProductionStatus } from "@/domain/production";
import { assertProductionTransition, publicProductionState } from "@/domain/production";
import { capturePublicPage } from "@/domain/source-security";
import { getPrisma } from "./db";
import { serialize } from "./http";
import { encryptSecret } from "./secrets";

export type ProductionRecord = {
  id: string;
  ownerUserId: string;
  workspaceId?: string;
  kind: ProductionKind;
  title: string;
  status: ProductionStatus;
  publicState: string;
  sourceId?: string;
  source?: string;
  direction: Record<string, unknown>;
  brief?: Record<string, unknown>;
  priceAtomic?: bigint;
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredQuote = {
  id: string;
  productionId: string;
  payer: `0x${string}`;
  standardPriceAtomic: bigint;
  discountAtomic: bigint;
  finalPriceAtomic: bigint;
  nexBalanceAtomic: bigint;
  nexThresholdAtomic: bigint;
  payerBalanceAtomic: bigint;
  eligible: boolean;
  sufficientBalance: boolean;
  pricingRuleVersion: string;
  chainConfigVersion: bigint;
  expiresAt: Date;
  createdAt: Date;
};

export type StoredRenderJob = {
  id: string;
  productionId: string;
  provider: string;
  providerJobId?: string;
  providerAssetId?: string;
  compositionHash: string;
  idempotencyKey: string;
  status: "QUEUED" | "UPLOADING" | "RENDERING" | "DOWNLOADING" | "CHECKING" | "COMPLETED" | "FAILED" | "CANCELLED";
  callbackId: string;
  outputUrl?: string;
  outputObjectKey?: string;
  errorCode?: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

function db() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Persistent Prisma storage is required.");
  return prisma;
}

export function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(serialize(value))).digest("hex");
}

function fromPrismaProduction(record: {
  id: string; ownerUserId: string; workspaceId: string | null; kind: ProductionKind; title: string;
  status: ProductionStatus; sourceId: string | null; direction: unknown; brief: unknown;
  priceAtomic: bigint | null; currentVersionId: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    workspaceId: record.workspaceId ?? undefined,
    kind: record.kind,
    title: record.title,
    status: record.status,
    publicState: publicProductionState(record.status),
    sourceId: record.sourceId ?? undefined,
    direction: (record.direction ?? {}) as Record<string, unknown>,
    brief: (record.brief ?? undefined) as Record<string, unknown> | undefined,
    priceAtomic: record.priceAtomic ?? undefined,
    currentVersionId: record.currentVersionId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  } satisfies ProductionRecord;
}

export async function listProductions(userId: string, options?: { cursor?: string; kind?: ProductionKind; status?: ProductionStatus }) {
  const records = await db().production.findMany({
    where: { ownerUserId: userId, kind: options?.kind, status: options?.status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    cursor: options?.cursor ? { id: options.cursor } : undefined,
    skip: options?.cursor ? 1 : 0,
    take: 51
  });
  const hasMore = records.length > 50;
  const page = records.slice(0, 50);
  return { items: page.map(fromPrismaProduction), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function getProduction(id: string, ownerUserId?: string) {
  const record = await db().production.findFirst({ where: { id, ownerUserId } });
  return record ? fromPrismaProduction(record) : null;
}

export async function createProduction(userId: string, input: {
  workspaceId?: string; kind: ProductionKind; title: string; source?: string; direction?: Record<string, unknown>;
}) {
  const prisma = db();
  if (input.workspaceId) {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } }
    });
    if (!membership) throw new Error("You do not have access to that workspace.");
  }
  const isUrl = Boolean(input.source && /^https?:\/\//i.test(input.source));
  const captured = isUrl ? await capturePublicPage(input.source!) : null;
  const record = await prisma.$transaction(async (tx) => {
    const source = input.source
      ? await tx.source.create({
          data: {
            ownerUserId: userId,
            workspaceId: input.workspaceId,
            name: captured?.title || (isUrl ? new URL(input.source).hostname : input.title),
            kind: isUrl ? "WEBSITE" : "TEXT",
            originalUrl: isUrl ? input.source : null,
            rawTextEncrypted: encryptSecret(captured?.text || input.source),
            extracted: captured
              ? { title: captured.title, finalUrl: captured.finalUrl, characters: captured.text.length, analysedAt: new Date().toISOString() }
              : { suppliedTextHash: contentHash(input.source), characters: input.source.length },
            rights: { attestedByUser: true, attestedAt: new Date().toISOString() },
            contentHash: contentHash(captured?.text || input.source),
            status: "READY"
          }
        })
      : null;
    return tx.production.create({
      data: {
        ownerUserId: userId,
        workspaceId: input.workspaceId,
        kind: input.kind,
        title: input.title,
        status: input.source ? "SOURCE_READY" : "DRAFT",
        sourceId: source?.id,
        direction: serialize(input.direction ?? {}) as never
      }
    });
  });
  return fromPrismaProduction(record);
}

export async function setProductionDirection(userId: string, id: string, direction: Record<string, unknown>, brief?: Record<string, unknown>) {
  const current = await getProduction(id, userId);
  if (!current) return null;
  if (!new Set(["SOURCE_READY", "DIRECTION_READY"]).has(current.status)) throw new Error(`Direction cannot be changed while production is ${current.status}`);
  const rawSourceIds = direction.sourceIds;
  if (rawSourceIds !== undefined && !Array.isArray(rawSourceIds)) throw new Error("Selected source identifiers must be an array.");
  const sourceIds = [...new Set((rawSourceIds || []).map((value) => {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error("A selected source identifier is invalid.");
    }
    return value;
  }))];
  if (sourceIds.length > 20) throw new Error("Choose no more than 20 sources for one production.");
  if (sourceIds.length) {
    const sources = await db().source.findMany({ where: { id: { in: sourceIds }, ownerUserId: userId, status: "READY" }, select: { id: true, rights: true } });
    if (sources.length !== sourceIds.length) throw new Error("Every selected source must belong to you and be ready for use.");
    if (sources.some((source) => !(source.rights && typeof source.rights === "object" && !Array.isArray(source.rights) && (source.rights as Record<string, unknown>).attestedByUser === true))) {
      throw new Error("Every selected source requires a rights attestation.");
    }
  }
  if (current.kind === "VIDEO" && direction.duration !== undefined && !new Set(["30 seconds", "Recommended"]).has(String(direction.duration))) {
    throw new Error("NexStudio v1 videos are fixed to 30 seconds.");
  }
  const normalizedDirection = current.kind === "VIDEO"
    ? { ...direction, duration: "30 seconds", durationSeconds: 30, sourceIds }
    : { ...direction, sourceIds };
  if (current.status === "SOURCE_READY") assertProductionTransition(current.status, "DIRECTION_READY");
  const record = await db().production.update({
    where: { id },
    data: { status: "DIRECTION_READY", direction: serialize(normalizedDirection) as never, brief: brief ? serialize(brief) as never : undefined }
  });
  return fromPrismaProduction(record);
}

export async function transitionProduction(id: string, statuses: ProductionStatus[], ownerUserId?: string) {
  let current = await getProduction(id, ownerUserId);
  if (!current) return null;
  for (const status of statuses) {
    assertProductionTransition(current.status, status);
    current = fromPrismaProduction(await db().production.update({ where: { id }, data: { status } }));
  }
  return current;
}

export async function saveQuote(input: Omit<StoredQuote, "id" | "createdAt">) {
  const quote = await db().quote.create({
    data: {
      productionId: input.productionId, payer: input.payer, standardPriceAtomic: input.standardPriceAtomic,
      discountAtomic: input.discountAtomic, finalPriceAtomic: input.finalPriceAtomic,
      nexBalanceAtomic: input.nexBalanceAtomic, nexThresholdAtomic: input.nexThresholdAtomic,
      payerBalanceAtomic: input.payerBalanceAtomic, eligible: input.eligible,
      pricingRuleVersion: input.pricingRuleVersion, chainConfigVersion: input.chainConfigVersion, expiresAt: input.expiresAt
    }
  });
  return { ...quote, payer: quote.payer as `0x${string}`, sufficientBalance: quote.payerBalanceAtomic >= quote.finalPriceAtomic } satisfies StoredQuote;
}

export async function getQuote(id: string) {
  const quote = await db().quote.findUnique({ where: { id } });
  return quote ? { ...quote, payer: quote.payer as `0x${string}`, sufficientBalance: quote.payerBalanceAtomic >= quote.finalPriceAtomic } satisfies StoredQuote : null;
}

export async function createSubmittedPayment(input: { userId: string; productionId: string; quote: StoredQuote; idempotencyKey: string; txHash: string }) {
  const existing = await db().paymentIntent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== input.userId || existing.productionId !== input.productionId || existing.txHash?.toLowerCase() !== input.txHash.toLowerCase()) throw new Error("Idempotency key was already used for a different payment.");
    return existing;
  }
  const production = await getProduction(input.productionId, input.userId);
  if (!production) return null;
  if (production.status !== "AWAITING_PAYMENT" && production.status !== "PAYMENT_PENDING") throw new Error(`Payment cannot begin while production is ${production.status}`);
  if (input.quote.expiresAt <= new Date()) throw new Error("Quote has expired.");
  if (!input.quote.sufficientBalance) throw new Error("The verified payer wallet does not have enough USDC for this quote.");
  if (production.status === "AWAITING_PAYMENT") await transitionProduction(production.id, ["PAYMENT_PENDING"], input.userId);
  return db().paymentIntent.create({
    data: {
      userId: input.userId, productionId: production.id, purpose: production.kind, referenceId: production.id,
      payer: input.quote.payer, token: "USDC", amountAtomic: input.quote.finalPriceAtomic,
      chainId: Number(process.env.ROBINHOOD_NETWORK === "mainnet" ? 4663 : 46630), quoteExpiresAt: input.quote.expiresAt,
      txHash: input.txHash, status: "SUBMITTED", idempotencyKey: input.idempotencyKey
    }
  });
}

export async function confirmPaymentIntent(paymentIntentId: string, contractPaymentId: string) {
  const prisma = db();
  const intent = await prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  if (!intent?.productionId) return null;
  await prisma.$transaction([
    prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "CONFIRMED", contractPaymentId } }),
    prisma.production.update({ where: { id: intent.productionId }, data: { status: "PAID", priceAtomic: intent.amountAtomic } })
  ]);
  return getProduction(intent.productionId, intent.userId);
}

export async function failPaymentIntent(paymentIntentId: string) {
  return db().paymentIntent.update({ where: { id: paymentIntentId }, data: { status: "FAILED" } });
}

export async function saveRenderJob(input: Omit<StoredRenderJob, "id" | "createdAt" | "updatedAt">) {
  return db().renderJob.create({
    data: { ...input, request: serialize(input.request) as never, response: input.response ? serialize(input.response) as never : undefined }
  });
}

export async function findRenderJobByCallback(callbackId: string) {
  return db().renderJob.findUnique({ where: { callbackId } });
}

export async function updateRenderJob(id: string, patch: Partial<Pick<StoredRenderJob, "status" | "providerJobId" | "providerAssetId" | "outputUrl" | "outputObjectKey" | "errorCode" | "response">>) {
  return db().renderJob.update({
    where: { id }, data: { ...patch, response: patch.response ? serialize(patch.response) as never : undefined }
  });
}

export async function getIdempotentResult(scope: string, key: string, requestHash: string) {
  const result = await db().idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
  if (result && result.requestHash !== requestHash) throw new Error("Idempotency key was already used for a different request");
  return result;
}

export async function saveIdempotentResult(scope: string, key: string, requestHash: string, statusCode: number, response: unknown) {
  await db().idempotencyRecord.create({
    data: { scope, key, requestHash, statusCode, response: serialize(response) as never, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });
}
