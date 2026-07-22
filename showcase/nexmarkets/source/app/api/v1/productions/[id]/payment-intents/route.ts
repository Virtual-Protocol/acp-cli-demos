import { z } from "zod";
import { opaqueProductionId, verifiedProductionPayment } from "@/lib/chain";
import { persistProductionPaymentEvent } from "@/lib/chain-events";
import { devSimulatedReceipt, isDevSimulationEnabled } from "@/lib/dev-simulation";
import { contentHash, confirmPaymentIntent, createSubmittedPayment, getIdempotentResult, getProduction, getQuote, saveIdempotentResult } from "@/lib/store";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  quoteId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value as `0x${string}`)
});

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const requestIdValue = auth.id;
  const originError = requireTrustedOrigin(request, requestIdValue);
  if (originError) return originError;
  const key = readIdempotencyKey(request, requestIdValue);
  if (key.response) return key.response;
  const idempotencyKey = key.value!;
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(requestIdValue, parsed.error);
  const { id } = await context.params;
  const hash = contentHash(parsed.data);

  try {
    const scope = `users:${auth.session.userId}:productions:${id}:payment`;
    const existing = await getIdempotentResult(scope, idempotencyKey, hash);
    if (existing) return json(existing.response, requestIdValue, { status: existing.statusCode });
    const quote = await getQuote(parsed.data.quoteId);
    if (!quote || quote.productionId !== id) return problem(requestIdValue, 404, "QUOTE_NOT_FOUND", "Quote not found", "Create a new quote for this production.");
    const intent = await createSubmittedPayment({ userId: auth.session.userId, productionId: id, quote, idempotencyKey, txHash: parsed.data.txHash });
    if (!intent) return problem(requestIdValue, 404, "PRODUCTION_NOT_FOUND", "Production not found", "No production exists for this payment.");
    let verified;
    try {
      verified = await verifiedProductionPayment(parsed.data.txHash, id, quote.payer, quote.finalPriceAtomic);
    } catch (error) {
      const response = { status: "SUBMITTED", paymentIntent: intent, production: await getProduction(id, auth.session.userId), detail: error instanceof Error ? error.message : "Confirmation is still pending." };
      return json(response, requestIdValue, { status: 202 });
    }
    const simulatedReceipt = verified.receipt.blockHash === devSimulatedReceipt().blockHash;
    if (!isDevSimulationEnabled() && !simulatedReceipt) {
      await persistProductionPaymentEvent({ txHash: parsed.data.txHash, opaqueId: opaqueProductionId(id), payload: { productionId: id, paymentIntentId: intent.id, payer: quote.payer, amountAtomic: quote.finalPriceAtomic.toString() }, verified });
    }
    const production = await confirmPaymentIntent(intent.id, verified.event.args.productionId!);
    const response = { status: "CONFIRMED", paymentIntent: { ...intent, status: "CONFIRMED" }, production };
    await saveIdempotentResult(scope, idempotencyKey, hash, 201, response);
    return json(response, requestIdValue, { status: 201 });
  } catch (error) {
    return problem(requestIdValue, 409, "PAYMENT_FAILED", "Payment could not be confirmed", error instanceof Error ? error.message : "Payment could not be confirmed.");
  }
}
