import { describe, expect, it } from "vitest";
import { closeFinancialOrder, monthlyOccurrenceDate, type FinancialCloseStore } from "./finance";

describe("financial close orchestration", () => {
  it("is idempotent and writes a ledger once", async () => {
    let cached: Awaited<ReturnType<typeof closeFinancialOrder>> | null = null;
    let writes = 0;
    const store: FinancialCloseStore = {
      load: async () => cached ? { state: "closed", result: cached } : { state: "open", input: { orderTotalCents: 10_000, taxBasisPoints: 500, payments: [{ id: "payment", method: "pix", amountCents: 10_000, installmentCount: 1, percentageBasisPoints: 0, fixedFeeCents: 0, manualFeeCents: null }], laborItems: [] } },
      persist: async (_workshopId, _serviceRecordId, result) => { cached = result; writes += 1; return result; },
    };
    const first = await closeFinancialOrder(store, "workshop", "order");
    const second = await closeFinancialOrder(store, "workshop", "order");
    expect(first.netTotalCents).toBe(9_500);
    expect(second).toEqual(first);
    expect(writes).toBe(1);
  });
});

describe("monthly recurrence", () => {
  it("keeps the configured day and clamps short months", () => {
    expect(monthlyOccurrenceDate(2027, 1, 31).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(monthlyOccurrenceDate(2027, 2, 5).toISOString()).toBe("2027-03-05T00:00:00.000Z");
  });
});
