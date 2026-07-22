import { z } from "zod";
import { productionChainQuote, productionPaymentCalls } from "@/lib/chain";
import { contentHash, getIdempotentResult, getProduction, saveIdempotentResult, saveQuote, transitionProduction } from "@/lib/store";
import { json, problem, zodProblem } from "@/lib/http";
import { idempotencyKey as readIdempotencyKey, requireSession, requireTrustedOrigin } from "@/lib/route-auth";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const quoteSchema = z.object({ payer: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value as `0x${string}`) });

export async function POST(request: Request, context: Context) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const requestIdValue = auth.id;
  const originError = requireTrustedOrigin(request, requestIdValue);
  if (originError) return originError;
  const key = readIdempotencyKey(request, requestIdValue);
  if (key.response) return key.response;
  const idempotencyKey = key.value!;
  const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodProblem(requestIdValue, parsed.error);
  const { id } = await context.params;
  const verifiedWallet = auth.session.user.wallets.find((wallet) => wallet.address.toLowerCase() === parsed.data.payer.toLowerCase() && wallet.chainId === Number(process.env.ROBINHOOD_NETWORK === "mainnet" ? 4663 : 46630));
  if (!verifiedWallet) return problem(requestIdValue, 403, "WALLET_NOT_VERIFIED", "Wallet is not verified", "Sign the NexMarkets wallet challenge before requesting a quote.");
  const hash = contentHash({ payer: parsed.data.payer.toLowerCase() });

  try {
    const scope = `users:${auth.session.userId}:productions:${id}:quote`;
    const existing = await getIdempotentResult(scope, idempotencyKey, hash);
    if (existing) return json(existing.response, requestIdValue, { status: existing.statusCode });
    let production = await getProduction(id, auth.session.userId);
    if (!production) return problem(requestIdValue, 404, "PRODUCTION_NOT_FOUND", "Production not found", "No production exists with that identifier.");
    if (!new Set(["DIRECTION_READY", "AWAITING_PAYMENT"]).has(production.status)) {
      return problem(requestIdValue, 409, "DIRECTION_NOT_READY", "Direction is not ready", "Approve a production direction before requesting a quote.");
    }
    if (production.status === "DIRECTION_READY") {
      production = await transitionProduction(id, ["AWAITING_PAYMENT"], auth.session.userId);
    }
    const calculated = await productionChainQuote(parsed.data.payer, production!.kind);
    const payerBalanceAtomic = calculated.usdcAtomic ?? 0n;
    const nexBalanceAtomic = calculated.nexAtomic ?? 0n;
    const quote = await saveQuote({
      productionId: id,
      payer: parsed.data.payer,
      standardPriceAtomic: calculated.standard,
      discountAtomic: calculated.standard - calculated.amount,
      finalPriceAtomic: calculated.amount,
      nexBalanceAtomic,
      nexThresholdAtomic: calculated.threshold,
      payerBalanceAtomic,
      eligible: calculated.eligible,
      sufficientBalance: payerBalanceAtomic >= calculated.amount,
      pricingRuleVersion: `chain-${calculated.version}`,
      chainConfigVersion: calculated.version,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    const response = { ...quote, chainId: calculated.chainId, calls: productionPaymentCalls(id, production!.kind, quote.finalPriceAtomic, quote.chainConfigVersion) };
    await saveIdempotentResult(scope, idempotencyKey, hash, 201, response);
    return json(response, requestIdValue, { status: 201 });
  } catch (error) {
    return problem(requestIdValue, 409, "QUOTE_FAILED", "Quote could not be created", error instanceof Error ? error.message : "The quote could not be created.");
  }
}
