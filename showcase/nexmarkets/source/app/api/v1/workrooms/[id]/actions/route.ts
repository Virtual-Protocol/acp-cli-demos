import { z } from "zod";
import { workroomActionCall } from "@/lib/chain";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { workroomPayloadHash } from "@/lib/workroom";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delivery"), message: z.string().trim().min(2).max(4_000), objectKeys: z.array(z.string()).max(20).default([]) }),
  z.object({ action: z.literal("revision"), request: z.string().trim().min(2).max(4_000), deliveryId: z.string().uuid().optional() }),
  z.object({ action: z.literal("approve") }), z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("dispute"), reason: z.string().trim().min(10).max(4_000), evidence: z.array(z.string()).max(20).default([]) })
]);

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params;
  const room = await getPrisma()!.workroom.findFirst({ where: { id, OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }] } });
  if (!room?.escrowId) return problem(auth.id, 409, "ESCROW_REQUIRED", "Escrow is not ready", "The on-chain Workroom escrow must be funded before this action.");
  const founderOnly = new Set(["revision", "approve"]);
  if (founderOnly.has(parsed.data.action) && room.founderUserId !== auth.session.userId) return problem(auth.id, 403, "FOUNDER_REQUIRED", "Founder action required", "Only the hiring side can take this action.");
  if (parsed.data.action === "delivery" && room.workerUserId !== auth.session.userId) return problem(auth.id, 403, "WORKER_REQUIRED", "Worker action required", "Only the selected worker can submit delivery.");
  const hash = parsed.data.action === "approve" || parsed.data.action === "release" ? undefined : workroomPayloadHash(parsed.data);
  try {
    return json({ action: parsed.data.action, payloadHash: hash, chainId: room.escrowId, call: workroomActionCall(id, parsed.data.action, hash) }, auth.id);
  } catch (error) {
    return problem(auth.id, 503, "ESCROW_UNCONFIGURED", "Escrow contract unavailable", error instanceof Error ? error.message : "The Workroom contract is not configured.");
  }
}
