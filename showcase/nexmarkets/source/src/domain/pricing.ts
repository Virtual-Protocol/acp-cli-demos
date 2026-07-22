import type { ProductionKind } from "./production";

export const USDC_DECIMALS = 6;
export const NEX_DECIMALS = 18;
export const VIDEO_PRICE_ATOMIC = 5_000_000n;
export const DISCOUNTED_VIDEO_PRICE_ATOMIC = 4_000_000n;
export const INFOGRAPHIC_PRICE_ATOMIC = 100_000n;
export const NEX_THRESHOLD_ATOMIC = 50_000n * 10n ** 18n;
export const PRICING_RULE_VERSION = "2026-07-hardhat-prisma-v1";

export type QuoteInput = {
  kind: ProductionKind;
  productionId: string;
  payer: `0x${string}`;
  nexBalanceAtomic: bigint;
  payerBalanceAtomic: bigint;
  now?: Date;
};

export function createProductionQuote(input: QuoteInput) {
  const standardPriceAtomic =
    input.kind === "VIDEO" ? VIDEO_PRICE_ATOMIC : INFOGRAPHIC_PRICE_ATOMIC;
  const eligible =
    input.kind === "VIDEO" && input.nexBalanceAtomic >= NEX_THRESHOLD_ATOMIC;
  const finalPriceAtomic = eligible
    ? DISCOUNTED_VIDEO_PRICE_ATOMIC
    : standardPriceAtomic;
  const now = input.now ?? new Date();

  return {
    productionId: input.productionId,
    payer: input.payer,
    standardPriceAtomic,
    discountAtomic: standardPriceAtomic - finalPriceAtomic,
    finalPriceAtomic,
    currency: "USDC" as const,
    tokenDecimals: USDC_DECIMALS,
    eligibility: {
      nexBalanceAtomic: input.nexBalanceAtomic,
      thresholdAtomic: NEX_THRESHOLD_ATOMIC,
      eligible
    },
    payerBalanceAtomic: input.payerBalanceAtomic,
    remainingBalanceAtomic: input.payerBalanceAtomic - finalPriceAtomic,
    sufficientBalance: input.payerBalanceAtomic >= finalPriceAtomic,
    pricingRuleVersion: PRICING_RULE_VERSION,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
  };
}
