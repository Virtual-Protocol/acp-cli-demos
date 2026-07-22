import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { contentHash, getIdempotentResult, getProduction, saveIdempotentResult, setProductionDirection } from "@/lib/store";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { requireProductionCapability } from "@/lib/production-access";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const directionSchema = z.object({
  direction: z.record(z.string(), z.unknown()),
  brief: z.record(z.string(), z.unknown()).optional()
});

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const requestIdValue = auth.id;
  const { id } = await context.params;
  const access = await requireProductionCapability(auth.session.userId, id, "view");
  const production = access ? await getProduction(id) : null;
  if (!production) return problem(requestIdValue, 404, "PRODUCTION_NOT_FOUND", "Production not found", "No production exists with that identifier.");
  const [currentVersion, latestRevision] = production.currentVersionId
    ? await Promise.all([
        getPrisma()!.productionVersion.findUnique({ where: { id: production.currentVersionId }, select: { id: true, versionNumber: true, createdAt: true, approvedAt: true, outputObjectKey: true } }),
        getPrisma()!.approval.findFirst({ where: { versionId: production.currentVersionId, artifactType: "PRODUCTION_VERSION", decision: "REJECTED" }, orderBy: { createdAt: "desc" }, select: { note: true, createdAt: true } })
      ])
    : [null, null];
  const owner = await getPrisma()!.user.findUnique({ where: { id: production.ownerUserId }, select: { displayName: true, handle: true } });
  return json({ ...production, owner, currentVersion, latestRevisionNote: latestRevision?.note ?? null, access: { owner: access!.owner, canBrief: access!.canBrief, canApproveBrief: access!.canApproveBrief, workroomId: access!.workroomId, expiresAt: access!.expiresAt } }, requestIdValue);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const requestIdValue = auth.id;
  const originError = requireTrustedOrigin(request, requestIdValue);
  if (originError) return originError;
  const key = readIdempotencyKey(request, requestIdValue);
  if (key.response) return key.response;
  const idempotencyKey = key.value!;
  const parsed = directionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(requestIdValue, parsed.error);
  const { id } = await context.params;
  const hash = contentHash(parsed.data);

  try {
    const scope = `users:${auth.session.userId}:productions:${id}:direction`;
    const existing = await getIdempotentResult(scope, idempotencyKey, hash);
    if (existing) return json(existing.response, requestIdValue, { status: existing.statusCode });
    const production = await setProductionDirection(auth.session.userId, id, parsed.data.direction, parsed.data.brief);
    if (!production) {
      return problem(requestIdValue, 404, "PRODUCTION_NOT_FOUND", "Production not found", "No production exists with that identifier.");
    }
    await saveIdempotentResult(scope, idempotencyKey, hash, 200, production);
    return json(production, requestIdValue);
  } catch (error) {
    return problem(requestIdValue, 409, "INVALID_PRODUCTION_STATE", "Direction cannot be updated", error instanceof Error ? error.message : "The production is not in a direction state.");
  }
}
