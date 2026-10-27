import { describe, expect, it } from "vitest";
import { summarizeServiceRevenue } from "./dashboard-service-revenue";

describe("dashboard service revenue", () => {
  it("ranks labor revenue, excludes parts and does not duplicate modern orders", () => {
    const result = summarizeServiceRevenue(
      [
        { orderId: "modern", catalogName: "Revisão", description: "Revisão completa", amountCents: 90000 },
        { orderId: "legacy", catalogName: "Troca de óleo", description: "Óleo e filtro", amountCents: 25000 },
      ],
      [
        { orderId: "modern", type: "service", catalogName: "Alinhamento", description: "Alinhamento", quantity: 2, unitPriceCents: 20000, discountCents: 5000 },
        { orderId: "modern", type: "part", catalogName: null, description: "Pastilha", quantity: 1, unitPriceCents: 50000, discountCents: 0 },
      ],
    );

    expect(result).toEqual([
      { name: "Alinhamento", serviceCount: 2, revenueCents: 35000, shareBasisPoints: 5833 },
      { name: "Troca de óleo", serviceCount: 1, revenueCents: 25000, shareBasisPoints: 4167 },
    ]);
  });

  it("groups equivalent names and never returns negative revenue", () => {
    const result = summarizeServiceRevenue(
      [],
      [
        { orderId: "a", type: "service", catalogName: "Troca de Óleo", description: "ignorada", quantity: 1, unitPriceCents: 10000, discountCents: 0 },
        { orderId: "b", type: "service", catalogName: null, description: "  troca   de oleo ", quantity: 1, unitPriceCents: 8000, discountCents: 20000 },
      ],
    );

    expect(result).toEqual([
      { name: "Troca de Óleo", serviceCount: 2, revenueCents: 10000, shareBasisPoints: 10000 },
    ]);
  });

  it("returns an empty ranking when the month has no service revenue", () => {
    expect(summarizeServiceRevenue([], [])).toEqual([]);
  });
});
