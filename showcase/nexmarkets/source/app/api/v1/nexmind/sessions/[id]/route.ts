import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { productionAccess } from "@/lib/production-access";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  partialTranscript: z.string().max(8_000).nullable().optional(),
  currentQuestion: z.string().max(2_000).nullable().optional(),
  liveState: z.enum(["idle", "listening", "understanding", "speaking", "paused", "reviewing"]).optional(),
  sourceId: z.string().uuid().optional(),
});

export async function GET(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const session = await getPrisma()!.liveSession.findFirst({
    where: { id },
    include: {
      messages: { orderBy: { sequence: "asc" }, take: 200 },
      production: { select: { id: true, kind: true, title: true, status: true, direction: true, brief: true } },
    },
  });
  const allowed = session && (session.userId === auth.session.userId || (session.productionId && (await productionAccess(auth.session.userId, session.productionId))?.owner));
  return session
    && allowed ? json({ ...session, readOnly: session.userId !== auth.session.userId }, auth.id)
    : problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "The session is unavailable.");
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({ where: { id, userId: auth.session.userId } });
  if (!session) return problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "The session is unavailable.");
  if (!new Set(["ACTIVE", "REVIEW"]).has(session.state)) return problem(auth.id, 409, "NEXMIND_SESSION_CLOSED", "Session is closed", "Start a new session to continue this outcome.");
  const nextContext: Record<string, unknown> = { ...record(session.context), ...parsed.data, transcriptSavedAt: new Date().toISOString() };
  if (parsed.data.sourceId) {
    const source = await prisma.source.findFirst({
      where: { id: parsed.data.sourceId, ownerUserId: auth.session.userId, status: "READY" },
      select: { id: true, name: true, kind: true, originalUrl: true, extracted: true, rights: true, contentHash: true, status: true },
    });
    if (!source) return problem(auth.id, 404, "SOURCE_NOT_READY", "Source is not ready", "Finish source analysis before attaching it to NexMind.");
    const sources = Array.isArray(nextContext.sources) ? nextContext.sources.filter((value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object") : [];
    if (!sources.some((value) => value.id === source.id)) sources.push(source);
    nextContext.sources = sources;
  }
  delete nextContext.sourceId;
  const updated = await prisma.liveSession.update({ where: { id }, data: { context: nextContext as never } });
  return json(updated, auth.id);
}
