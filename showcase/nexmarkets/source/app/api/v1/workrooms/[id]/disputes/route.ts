import { z } from "zod";
import { opaqueWorkroomId, verifiedWorkroomEvent } from "@/lib/chain";
import { persistWorkEscrowEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { json, problem, zodProblem } from "@/lib/http";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { workroomPayloadHash } from "@/lib/workroom";
import { env } from "@/lib/env";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().trim().min(10).max(4_000), evidence: z.array(z.string()).max(20).default([]), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) });
export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request); if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id); if (originError) return originError;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return zodProblem(auth.id, parsed.error);
  const { id } = await context.params; const prisma = getPrisma()!;
  const room = await prisma.workroom.findFirst({ where: { id, OR: [{ founderUserId: auth.session.userId }, { workerUserId: auth.session.userId }], status: { in: ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"] } } });
  if (!room) return problem(auth.id, 409, "DISPUTE_NOT_ALLOWED", "Dispute is not available", "Only a participant can dispute active or delivered work.");
  const hash = workroomPayloadHash({ action: "dispute", reason: parsed.data.reason, evidence: parsed.data.evidence });
  try {
    const verified = await verifiedWorkroomEvent(parsed.data.txHash, id, "DisputeOpened", hash);
    await persistWorkEscrowEvent({ txHash: parsed.data.txHash, eventName: "DisputeOpened", opaqueId: opaqueWorkroomId(id), payload: { workroomId: id, reasonHash: hash }, verified });
    const resolver = env.disputeResolverAddress ? await prisma.wallet.findFirst({ where: { address: env.disputeResolverAddress }, select: { userId: true } }) : null;
    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.workroomDispute.create({ data: { workroomId: id, openedById: auth.session.userId, reason: parsed.data.reason, evidence: parsed.data.evidence } });
      await tx.workroom.update({ where: { id }, data: { status: "DISPUTED" } });
      if (resolver) await createNotification(tx, { userId: resolver.userId, kind: "DISPUTE_OPENED", title: "Workroom dispute needs review", body: parsed.data.reason, deepLink: "/admin/disputes" });
      return created;
    });
    return json(dispute, auth.id, { status: 201 });
  } catch (error) { return problem(auth.id, 409, "DISPUTE_TX_INVALID", "Dispute transaction is invalid", error instanceof Error ? error.message : "The dispute could not be verified."); }
}
