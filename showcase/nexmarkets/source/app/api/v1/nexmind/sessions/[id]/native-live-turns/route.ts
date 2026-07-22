import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  userText: z.string().trim().min(1).max(8_000).optional(),
  assistantText: z.string().trim().min(1).max(8_000).optional(),
  provider: z.string().trim().max(120).default("gemini-live"),
  inputMode: z.literal("VOICE").default("VOICE"),
}).refine((value) => value.userText || value.assistantText, { message: "At least one transcript side is required." });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({
    where: { id, userId: auth.session.userId, state: { in: ["ACTIVE", "REVIEW"] } },
    include: { messages: { orderBy: { sequence: "desc" }, take: 1 } },
  });
  if (!session) return problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "Start or resume an active session.");

  let sequence = (session.messages[0]?.sequence ?? 0) + 1;
  const writes = [];
  if (parsed.data.userText) {
    writes.push(prisma.liveSessionMessage.create({ data: { sessionId: id, sequence, speaker: "USER", text: parsed.data.userText, metadata: { inputMode: parsed.data.inputMode, provider: parsed.data.provider, nativeLive: true } } }));
    sequence += 1;
  }
  if (parsed.data.assistantText) {
    writes.push(prisma.liveSessionMessage.create({ data: { sessionId: id, sequence, speaker: "NEXMIND", text: parsed.data.assistantText, metadata: { provider: parsed.data.provider, nativeLive: true } } }));
  }

  const question = parsed.data.assistantText?.includes("?") ? parsed.data.assistantText.split(/(?<=[?])\s+/).findLast((part) => part.includes("?")) || parsed.data.assistantText : null;
  const nextContext: Record<string, unknown> = { ...record(session.context), partialTranscript: null, liveState: "idle", transcriptSavedAt: new Date().toISOString(), nativeLiveProvider: parsed.data.provider };
  if (question) nextContext.currentQuestion = question;
  delete nextContext.proposal;
  delete nextContext.proposalGeneratedAt;

  await prisma.$transaction([
    ...writes,
    prisma.liveSession.update({ where: { id }, data: { state: "ACTIVE", context: nextContext as never } }),
  ]);

  return json({ saved: true, nextSequence: sequence + 1 }, auth.id, { status: 201 });
}
