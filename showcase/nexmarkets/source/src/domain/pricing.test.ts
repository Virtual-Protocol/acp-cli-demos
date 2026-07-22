import { describe, expect, it } from "vitest";
import {
  createProductionQuote,
  DISCOUNTED_VIDEO_PRICE_ATOMIC,
  INFOGRAPHIC_PRICE_ATOMIC,
  NEX_THRESHOLD_ATOMIC,
  VIDEO_PRICE_ATOMIC
} from "./pricing";

const payer = "0x1111111111111111111111111111111111111111" as const;

describe("production pricing", () => {
  it("uses the standard price below the exact NEX boundary", () => {
    const quote = createProductionQuote({
      kind: "VIDEO",
      productionId: "p1",
      payer,
      nexBalanceAtomic: NEX_THRESHOLD_ATOMIC - 1n,
      payerBalanceAtomic: 20_000_000n
    });
    expect(quote.finalPriceAtomic).toBe(VIDEO_PRICE_ATOMIC);
    expect(quote.eligibility.eligible).toBe(false);
  });

  it("uses the discounted price at the exact boundary", () => {
    const quote = createProductionQuote({
      kind: "VIDEO",
      productionId: "p1",
      payer,
      nexBalanceAtomic: NEX_THRESHOLD_ATOMIC,
      payerBalanceAtomic: 20_000_000n
    });
    expect(quote.finalPriceAtomic).toBe(DISCOUNTED_VIDEO_PRICE_ATOMIC);
    expect(quote.eligibility.eligible).toBe(true);
  });

  it("never applies the NEX discount to a still", () => {
    const quote = createProductionQuote({
      kind: "INFOGRAPHIC",
      productionId: "p2",
      payer,
      nexBalanceAtomic: NEX_THRESHOLD_ATOMIC * 10n,
      payerBalanceAtomic: 20_000_000n
    });
    expect(quote.finalPriceAtomic).toBe(INFOGRAPHIC_PRICE_ATOMIC);
    expect(quote.eligibility.eligible).toBe(false);
  });
});
