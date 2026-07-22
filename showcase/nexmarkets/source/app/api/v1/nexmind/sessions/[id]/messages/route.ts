import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { callNexMind, record } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { groundedSessionContext } from "@/lib/source-grounding";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ text: z.string().trim().min(1).max(8_000), inputMode: z.enum(["TEXT", "VOICE"]).default("TEXT") });

function systemPrompt(purpose: string, context: unknown, questionsAsked: number) {
  const productionMode = purpose === "PRODUCTION_DIRECTION" ? " You are a production interface, not a general chatbot. Move from ambiguity to a production lock. Prefer recommendations over questionnaires. Ask only questions that materially change objective, audience, core message, format, evidence, or direction. When enough is known, summarize the current direction and tell the user the next useful step is review/build." : "";
  return `You are NexMind inside NexMarkets. Session purpose: ${purpose}.${productionMode} Use only the supplied grounded context and the user's statements. Ask one short decision-changing question at a time. A session should use no more than five material questions. ${questionsAsked >= 5 ? "Five questions have already been asked: do not ask another; summarize what is confirmed and tell the user the outcome is ready for review." : `You may ask at most ${5 - questionsAsked} more material question(s).`} Never invent source facts, wallet balances, professional claims, evidence, pricing, deadlines, approval, or completed work. Explicitly distinguish proposals from confirmed decisions. Do not claim that an action was saved, published, paid, rendered, or submitted unless the grounded context says so. Grounded context: ${JSON.stringify(context)}`;
}

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!env.nexmindApiUrl || !env.nexmindApiKey) return problem(auth.id, 503, "NEXMIND_NOT_CONFIGURED", "NexMind is unavailable", "Configure the NexMind provider endpoint and key.");
  const providerLimit = await consumeRateLimit(auth.session.userId, "nexmind_message", 30, 60_000);
  if (!providerLimit.allowed) return problem(auth.id, 429, "NEXMIND_RATE_LIMITED", "NexMind is receiving too many messages", `Wait ${providerLimit.retryAfterSeconds} seconds before sending another message.`);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({
    where: { id, userId: auth.session.userId, state: { in: ["ACTIVE", "REVIEW"] } },
    include: { messages: { orderBy: { sequence: "asc" }, take: 100 } },
  });
  if (!session) return problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "Start or resume an active session.");
  let providerContext;
  try { providerContext = await groundedSessionContext(auth.session.userId, session.context, session.productionId); }
  catch (error) { return problem(auth.id, 409, "SOURCE_GROUNDING_FAILED", "Source grounding failed", error instanceof Error ? error.message : "The selected source content is unavailable."); }
  const userSequence = (session.messages.at(-1)?.sequence ?? 0) + 1;
  const questionsAsked = session.messages.filter((message) => message.speaker === "NEXMIND" && message.text.includes("?")).length;
  const providerMessages = [
    { role: "system" as const, content: systemPrompt(session.purpose, providerContext, questionsAsked) },
    ...session.messages.map((message) => ({ role: message.speaker === "USER" ? "user" as const : "assistant" as const, content: message.text })),
    { role: "user" as const, content: parsed.data.text },
  ];
  await prisma.liveSessionMessage.create({ data: { sessionId: id, sequence: userSequence, speaker: "USER", text: parsed.data.text, metadata: { inputMode: parsed.data.inputMode } } });
  let reply: string;
  try {
    reply = await callNexMind(providerMessages);
  } catch (error) {
    return problem(auth.id, 502, "NEXMIND_PROVIDER_FAILED", "NexMind did not respond", error instanceof Error ? error.message : "The configured provider did not return a response.");
  }
  const question = reply.includes("?") ? reply.split(/(?<=[?])\s+/).findLast((part) => part.includes("?")) || reply : null;
  const nextContext: Record<string, unknown> = { ...record(session.context), partialTranscript: null, currentQuestion: question, liveState: "idle", transcriptSavedAt: new Date().toISOString() };
  delete nextContext.proposal;
  delete nextContext.proposalGeneratedAt;
  await prisma.$transaction([
    prisma.liveSessionMessage.create({ data: { sessionId: id, sequence: userSequence + 1, speaker: "NEXMIND", text: reply, metadata: { provider: env.nexmindModel } } }),
    prisma.liveSession.update({ where: { id }, data: { state: "ACTIVE", context: nextContext as never } }),
  ]);
  return json({
    user: { sequence: userSequence, text: parsed.data.text, speaker: "USER" },
    assistant: { sequence: userSequence + 1, text: reply, speaker: "NEXMIND" },
    questionsAsked: questionsAsked + (reply.includes("?") ? 1 : 0),
    readyForReview: questionsAsked >= 4 || !reply.includes("?"),
  }, auth.id, { status: 201 });
}
