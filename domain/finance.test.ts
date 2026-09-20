import { describe, expect, it } from "vitest";
import { buildFinancialSnapshot } from "./finance";

describe("financial snapshot", () => {
  const services = [
    { description: "Troca de óleo", amountCents: 20000, completedAt: new Date("2026-09-05T12:00:00Z") },
    { description: "Revisão", amountCents: 50000, completedAt: new Date("2026-09-10T12:00:00Z") },
    { description: "Troca de óleo", amountCents: 30000, completedAt: new Date("2026-08-10T12:00:00Z") },
  ];

  it("summarizes current revenue, comparison and average ticket", () => {
    const snapshot = buildFinancialSnapshot(services, new Date("2026-09-20T12:00:00Z"));
    expect(snapshot.currentMonthRevenueCents).toBe(70000);
    expect(snapshot.previousMonthRevenueCents).toBe(30000);
    expect(snapshot.monthChangePercent).toBe(133);
    expect(snapshot.averageTicketCents).toBe(33333);
  });

  it("groups the services by revenue", () => {
    const snapshot = buildFinancialSnapshot(services, new Date("2026-09-20T12:00:00Z"));
    expect(snapshot.topServices[0]).toEqual({ name: "Troca de óleo", revenueCents: 50000, serviceCount: 2 });
    expect(snapshot.monthlyRevenue).toHaveLength(6);
    expect(snapshot.monthlyRevenue.at(-1)?.revenueCents).toBe(70000);
  });

  it("does not invent a percentage without a previous month baseline", () => {
    const snapshot = buildFinancialSnapshot(services.slice(0, 2), new Date("2026-09-20T12:00:00Z"));
    expect(snapshot.monthChangePercent).toBeNull();
  });
});
