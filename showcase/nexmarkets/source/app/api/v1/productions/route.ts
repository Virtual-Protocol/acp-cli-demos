import { z } from "zod";
import { productionKinds } from "@/domain/production";
import { assertPublicHttpUrl } from "@/domain/source-security";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import {
  contentHash,
  createProduction,
  getIdempotentResult,
  listProductions,
  saveIdempotentResult
} from "@/lib/store";

export const runtime = "nodejs";

const createSchema = z.object({
  kind: z.enum(productionKinds),
  title: z.string().trim().min(2).max(120),
  source: z.string().trim().min(2).max(20_000).optional(),
  direction: z.record(z.string(), z.unknown()).optional()
  ,workspaceId: z.string().uuid().optional()
});

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const kind = productionKinds.includes(url.searchParams.get("kind") as never) ? url.searchParams.get("kind") as (typeof productionKinds)[number] : undefined;
  return json(await listProductions(auth.session.userId, { cursor: url.searchParams.get("cursor") || undefined, kind }), auth.id);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const id = auth.id;
  const originError = requireTrustedOrigin(request, id);
  if (originError) return originError;
  const key = readIdempotencyKey(request, id);
  if (key.response) return key.response;
  const idempotencyKey = key.value!;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(id, parsed.error);
  const hash = contentHash(parsed.data);

  try {
    const scope = `users:${auth.session.userId}:productions:create`;
    const existing = await getIdempotentResult(scope, idempotencyKey, hash);
    if (existing) return json(existing.response, id, { status: existing.statusCode });

    if (parsed.data.source && /^https?:\/\//i.test(parsed.data.source)) {
      await assertPublicHttpUrl(parsed.data.source);
    }
    const production = await createProduction(auth.session.userId, parsed.data);
    await saveIdempotentResult(scope, idempotencyKey, hash, 201, production);
    return json(production, id, { status: 201 });
  } catch (error) {
    return problem(
      id,
      400,
      "PRODUCTION_CREATE_FAILED",
      "Production could not be created",
      error instanceof Error ? error.message : "The production request could not be completed."
    );
  }
}
