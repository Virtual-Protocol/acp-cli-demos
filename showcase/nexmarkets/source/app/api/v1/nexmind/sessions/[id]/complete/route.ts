import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem } from "@/lib/http";
import { callNexMind, nexMindProposalSchema, parseProviderJson, proposalInstruction, record, type NexMindPurpose } from "@/lib/nexmind";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { groundedSessionContext } from "@/lib/source-grounding";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const expectedKind: Record<NexMindPurpose, "production" | "reputation" | "listing" | "application"> = {
  PRODUCTION_DIRECTION: "production",
  REPUTATION_ENHANCEMENT: "reputation",
  LISTING_PREPARATION: "listing",
  APPLICATION_PREPARATION: "application",
};

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!env.nexmindApiUrl || !env.nexmindApiKey) return problem(auth.id, 503, "NEXMIND_NOT_CONFIGURED", "NexMind is unavailable", "Configure the NexMind provider endpoint and key.");
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const session = await prisma.liveSession.findFirst({
    where: { id, userId: auth.session.userId, state: { in: ["ACTIVE", "REVIEW"] } },
    include: { messages: { orderBy: { sequence: "asc" }, take: 200 } },
  });
  if (!session) return problem(auth.id, 404, "NEXMIND_SESSION_NOT_FOUND", "NexMind session not found", "Start or resume a session before preparing its outcome.");
  if (!session.messages.length) return problem(auth.id, 409, "NEXMIND_TRANSCRIPT_EMPTY", "The conversation is empty", "Add the intended outcome before asking NexMind to structure it.");
  let providerContext;
  try { providerContext = await groundedSessionContext(auth.session.userId, session.context, session.productionId); }
  catch (error) { return problem(auth.id, 409, "SOURCE_GROUNDING_FAILED", "Source grounding failed", error instanceof Error ? error.message : "The selected source content is unavailable."); }
  const purpose = session.purpose as NexMindPurpose;
  const transcript = session.messages.map((message) => `${message.speaker === "USER" ? "User" : "NexMind"}: ${message.text}`).join("\n");
  let raw: string;
  try {
    raw = await callNexMind([
      { role: "system", content: `${proposalInstruction(purpose)} Grounded session context: ${JSON.stringify(providerContext)}` },
      { role: "user", content: `Create the review object from this transcript. Do not treat NexMind's own suggestions as user-confirmed unless the user explicitly agreed.\n\n${transcript}` },
    ], { json: true });
  } catch (error) {
    return problem(auth.id, 502, "NEXMIND_PROVIDER_FAILED", "NexMind could not structure the outcome", error instanceof Error ? error.message : "The provider did not return a review object.");
  }
  let parsed;
  try {
    parsed = nexMindProposalSchema.parse(parseProviderJson(raw));
  } catch (error) {
    return problem(auth.id, 502, "NEXMIND_INVALID_OUTCOME", "NexMind returned an invalid outcome", error instanceof Error ? error.message : "The provider response did not match the required approval schema.");
  }
  if (parsed.kind !== expectedKind[purpose]) return problem(auth.id, 502, "NEXMIND_WRONG_OUTCOME", "NexMind returned the wrong outcome type", `Expected ${expectedKind[purpose]} but received ${parsed.kind}.`);
  const nextContext = { ...record(session.context), proposal: parsed, partialTranscript: null, currentQuestion: null, liveState: "reviewing", proposalGeneratedAt: new Date().toISOString() };
  const production = session.productionId ? await prisma.production.findUnique({ where: { id: session.productionId }, select: { ownerUserId: true, title: true, status: true } }) : null;
  await prisma.$transaction(async (tx) => {
    await tx.liveSession.update({ where: { id }, data: { state: "REVIEW", context: nextContext as never } });
    if (session.productionId && production && new Set(["PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"]).has(production.status)) {
      await tx.production.update({ where: { id: session.productionId }, data: { status: "BRIEF_REVIEW" } });
    }
    if (production && production.ownerUserId !== auth.session.userId) await createNotification(tx, { userId: production.ownerUserId, kind: "DELEGATED_BRIEF_REVIEW", title: "Delegated Studio brief ready", body: `${production.title} has a structured NexMind brief ready for your decision.`, deepLink: `/nexmind?session=${session.id}` });
  });
  return json({ sessionId: id, proposal: parsed }, auth.id);
}
