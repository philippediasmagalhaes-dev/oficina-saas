import { describe, expect, it } from "vitest";
import { calculateQuoteTotal, canTransitionWorkOrder, nextQuotePublication, nextQuoteVersion } from "./work-orders";

describe("work order workflow", () => {
  it("allows the expected service path and blocks shortcuts", () => {
    expect(canTransitionWorkOrder("open", "diagnosis")).toBe(true);
    expect(canTransitionWorkOrder("diagnosis", "awaiting_approval")).toBe(true);
    expect(canTransitionWorkOrder("approved", "in_progress")).toBe(true);
    expect(canTransitionWorkOrder("open", "delivered")).toBe(false);
    expect(canTransitionWorkOrder("delivered", "in_progress")).toBe(false);
  });

  it("calculates subtotal, capped discount and total", () => {
    expect(calculateQuoteTotal([{ quantity: 2, unitPriceCents: 1500 }, { quantity: 1, unitPriceCents: 5000 }], 1000)).toEqual({ subtotalCents: 8000, discountCents: 1000, totalCents: 7000 });
    expect(calculateQuoteTotal([{ quantity: 1, unitPriceCents: 1000 }], 2000).totalCents).toBe(0);
  });

  it("increments the quote version when an approved proposal is revised", () => {
    expect(nextQuoteVersion(1)).toBe(2);
    expect(() => nextQuoteVersion(0)).toThrow("Versão de orçamento inválida");
  });

  it("rotates version and token after a decided quote", () => {
    expect(nextQuotePublication({ currentVersion: 1, quoteStatus: "rejected", currentToken: "old", createToken: () => "new" })).toEqual({ quoteVersion: 2, quoteToken: "new" });
    expect(nextQuotePublication({ currentVersion: 2, quoteStatus: "draft", currentToken: "same", createToken: () => "unused" })).toEqual({ quoteVersion: 2, quoteToken: "same" });
  });
});
