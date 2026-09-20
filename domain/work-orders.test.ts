import { describe, expect, it } from "vitest";
import { calculateQuoteTotal, canTransitionWorkOrder } from "./work-orders";

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
});
