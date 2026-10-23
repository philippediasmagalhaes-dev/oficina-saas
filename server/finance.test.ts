import { describe, expect, it } from "vitest";
import { closeFinancialOrder, type FinancialCloseStore } from "./finance";

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
