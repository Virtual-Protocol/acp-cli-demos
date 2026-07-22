import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { opaqueProductionId, productionOperatorCall, verifiedProductionOperatorEvent } from "@/lib/chain";
import { persistProductionPaymentEvent } from "@/lib/chain-events";
import { getPrisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json, problem, zodProblem } from "@/lib/http";
import { isProductionOperator } from "@/lib/roles";
import { requireSession, requireTrustedOrigin } from "@/lib/route-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("prepare"), action: z.enum(["settle", "refund"]), reason: z.string().trim().min(10).max(2_000).optional() }),
  z.object({ mode: z.literal("confirm"), action: z.enum(["settle", "refund"]), reason: z.string().trim().min(10).max(2_000).optional(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`) }),
]);

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const originError = requireTrustedOrigin(request, auth.id);
  if (originError) return originError;
  if (!isProductionOperator(auth.session.user)) return problem(auth.id, 403, "PRODUCTION_OPERATOR_REQUIRED", "Production operator access required", "Use the verified wallet configured for the production payment operator role.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(auth.id, parsed.error);
  if (parsed.data.action === "refund" && !parsed.data.reason) return problem(auth.id, 422, "REFUND_REASON_REQUIRED", "Refund reason required", "Record a clear reason before returning the production payment.");
  const { id } = await context.params;
  const prisma = getPrisma()!;
  const production = await prisma.production.findUnique({ where: { id }, include: { paymentIntents: { orderBy: { createdAt: "desc" }, take: 1 }, approvals: { where: { artifactType: "PRODUCTION_REFUND_REQUEST" }, take: 1 } } });
  const payment = production?.paymentIntents[0];
  if (!production || !payment || payment.status !== "CONFIRMED") return problem(auth.id, 409, "CONFIRMED_PAYMENT_REQUIRED", "Confirmed production payment required", "This production payment is not awaiting settlement or refund.");
  const allowed = parsed.data.action === "settle" ? production.status === "APPROVED" : production.status === "FAILED" || production.approvals.length > 0;
  if (!allowed) return problem(auth.id, 409, "PRODUCTION_PAYMENT_ACTION_INVALID", "Payment action is not allowed", parsed.data.action === "settle" ? "Only an owner-approved final production can settle to treasury." : "Refund requires a failed production or an owner refund request.");
  const operatorWallet = auth.session.user.wallets.find((wallet) => wallet.address.toLowerCase() === env.productionOperatorAddress);
  if (!operatorWallet) return problem(auth.id, 403, "OPERATOR_WALLET_REQUIRED", "Operator wallet required", "Connect the configured production operator wallet.");
  const reasonHash = parsed.data.action === "refund" ? keccak256(toBytes(`NEX:PRODUCTION_REFUND:${parsed.data.reason}`)) : undefined;
  if (parsed.data.mode === "prepare") return json({ productionId: id, action: parsed.data.action, chainId: env.robinhoodChainId, amountAtomic: payment.amountAtomic, reasonHash, call: productionOperatorCall(id, parsed.data.action, reasonHash) }, auth.id);
  const confirmed = parsed.data;
  try {
    const verified = await verifiedProductionOperatorEvent({ txHash: confirmed.txHash, productionId: id, action: confirmed.action, amount: payment.amountAtomic, payer: payment.payer as `0x${string}`, reasonHash, operator: operatorWallet.address as `0x${string}` });
    await persistProductionPaymentEvent({ txHash: confirmed.txHash, eventName: confirmed.action === "settle" ? "ProductionSettled" : "ProductionRefunded", opaqueId: opaqueProductionId(id), payload: { productionId: id, action: confirmed.action, amountAtomic: payment.amountAtomic, reasonHash }, verified });
    await prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({ where: { id: payment.id }, data: { status: confirmed.action === "settle" ? "SETTLED" : "REFUNDED" } });
      if (confirmed.action === "refund") await tx.production.update({ where: { id }, data: { status: "REFUNDED" } });
      await tx.auditEvent.create({ data: { actorUserId: auth.session.userId, actorWallet: operatorWallet.address, action: confirmed.action === "settle" ? "PRODUCTION_PAYMENT_SETTLED" : "PRODUCTION_PAYMENT_REFUNDED", entityType: "Production", entityId: id, after: { txHash: confirmed.txHash, amountAtomic: payment.amountAtomic.toString(), reason: confirmed.reason || null }, requestId: auth.id } });
      await createNotification(tx, { userId: production.ownerUserId, kind: confirmed.action === "settle" ? "PRODUCTION_SETTLED" : "PRODUCTION_REFUNDED", title: confirmed.action === "settle" ? "Production payment settled" : "Production payment refunded", body: confirmed.action === "settle" ? `${production.title} is complete and its approved payment was settled.` : confirmed.reason!, deepLink: `/studio/${id}` });
    });
    return json({ productionId: id, paymentIntentId: payment.id, status: confirmed.action === "settle" ? "SETTLED" : "REFUNDED" }, auth.id);
  } catch (error) {
    return problem(auth.id, 409, "PRODUCTION_PAYMENT_EVENT_NOT_VERIFIED", "Production payment action was not verified", error instanceof Error ? error.message : "The confirmed transaction did not match the requested payment action.");
  }
}
