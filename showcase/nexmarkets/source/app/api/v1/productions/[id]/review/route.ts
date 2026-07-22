import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { contentHash, getIdempotentResult, saveIdempotentResult } from "@/lib/store";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("revision"), note: z.string().trim().min(2).max(2_000) })
]);

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const key = readIdempotencyKey(request, auth.id);
  if (key.response) return key.response;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const scope = `users:${auth.session.userId}:productions:${id}:review`;
  const hash = contentHash(parsed.data);
  try {
    const existing = await getIdempotentResult(scope, key.value!, hash);
    if (existing) return json(existing.response, auth.id, { status: existing.statusCode });
    const prisma = getPrisma()!;
    const production = await prisma.production.findFirst({
      where: { id, ownerUserId: auth.session.userId, status: "VERSION_READY" },
      include: { currentVersion: true }
    });
    if (!production?.currentVersion?.outputObjectKey) {
      return problem(auth.id, 409, "VERSION_REVIEW_UNAVAILABLE", "Version review is unavailable", "A persisted version must be ready before it can be approved or revised.");
    }
    const version = production.currentVersion;
    const decisionHash = contentHash({ versionId: version.id, sourceHash: version.sourceHash, action: parsed.data.action, note: "note" in parsed.data ? parsed.data.note : undefined });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          userId: auth.session.userId,
          productionId: production.id,
          versionId: version.id,
          artifactType: "PRODUCTION_VERSION",
          artifactId: version.id,
          artifactHash: decisionHash,
          decision: parsed.data.action === "approve" ? "APPROVED" : "REJECTED",
          note: "note" in parsed.data ? parsed.data.note : undefined
        }
      });
      if (parsed.data.action === "approve") {
        await tx.productionVersion.update({ where: { id: version.id }, data: { approvedAt: new Date() } });
        return tx.production.update({ where: { id: production.id }, data: { status: "APPROVED", approverUserId: auth.session.userId } });
      }
      return tx.production.update({ where: { id: production.id }, data: { status: "REVISION_REQUESTED" } });
    });
    const response = { production: updated, versionId: version.id, action: parsed.data.action };
    await saveIdempotentResult(scope, key.value!, hash, 200, response);
    return json(response, auth.id);
  } catch (error) {
    return problem(auth.id, 409, "VERSION_REVIEW_FAILED", "Version review could not be saved", error instanceof Error ? error.message : "The review decision could not be persisted.");
  }
}
