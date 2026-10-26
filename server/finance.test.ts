import { describe, expect, it } from "vitest";
import {
  applyFinancialSettlement,
  buildInstallmentEntryDrafts,
  calculateCashClosing,
  closeFinancialOrder,
  monthlyOccurrenceDate,
  reverseFinancialSettlement,
  selectConfiguredPaymentFeeRule,
  type FinancialCloseStore,
  type FinancialSettlementStore,
} from "./finance";

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

describe("installment fee selection", () => {
  it("selects the active rule for the exact credit-card installment count", () => {
    const rules = [
      { id: "one", paymentMethod: "credit_card", installmentCount: 1, active: true, effectiveFrom: new Date("2026-01-01") },
      { id: "six-old", paymentMethod: "credit_card", installmentCount: 6, active: false, effectiveFrom: new Date("2026-01-01") },
      { id: "six", paymentMethod: "credit_card", installmentCount: 6, active: true, effectiveFrom: new Date("2026-02-01") },
    ];
    expect(selectConfiguredPaymentFeeRule(rules, "credit_card", 6)?.id).toBe("six");
    expect(selectConfiguredPaymentFeeRule(rules, "credit_card", 2)).toBeNull();
  });
});

describe("monthly recurrence", () => {
  it("keeps the configured day and clamps short months", () => {
    expect(monthlyOccurrenceDate(2027, 1, 31).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(monthlyOccurrenceDate(2027, 2, 5).toISOString()).toBe("2027-03-05T00:00:00.000Z");
  });
});

describe("financial installments", () => {
  it("builds cent-exact, stable installment identities for idempotent writes", () => {
    const input = {
      totalCents: 10_000,
      installmentCount: 3,
      firstDueDate: new Date("2026-01-31T00:00:00Z"),
      groupId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "invoice-42",
    };
    const first = buildInstallmentEntryDrafts(input);
    const retry = buildInstallmentEntryDrafts(input);
    expect(first).toEqual(retry);
    expect(first.map((item) => item.externalId)).toEqual([
      "manual:invoice-42:1",
      "manual:invoice-42:2",
      "manual:invoice-42:3",
    ]);
    expect(first.reduce((total, item) => total + item.amountCents, 0)).toBe(10_000);
    expect(first[1].dueDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("cash closing", () => {
  it("calculates the expected balance and declared difference", () => {
    expect(calculateCashClosing(10_000, [5_000, -2_000, 1_500], 14_000)).toEqual({
      calculatedClosingCents: 14_500,
      declaredClosingCents: 14_000,
      differenceCents: -500,
    });
  });
});

function settlementStore(workshopId = "workshop-a") {
  const entry = { id: "entry", workshopId, grossAmountCents: 10_000, status: "expected" as const };
  const settlements: Array<{ id: string; amountCents: number; reversedAt: Date | null }> = [];
  let status: "expected" | "partial" | "settled" | "cancelled" = entry.status;
  const store: FinancialSettlementStore = {
    loadEntry: async (scope, entryId) => scope === workshopId && entryId === entry.id ? { ...entry, status } : null,
    listSettlements: async (scope, entryId) => scope === workshopId && entryId === entry.id ? settlements : [],
    createSettlement: async (input) => {
      const settlement = { id: `settlement-${settlements.length + 1}`, amountCents: input.amountCents, reversedAt: null };
      settlements.push(settlement);
      return settlement;
    },
    reverseSettlement: async (scope, settlementId, reversedAt) => {
      if (scope !== workshopId) return;
      const settlement = settlements.find((item) => item.id === settlementId);
      if (settlement) settlement.reversedAt = reversedAt;
    },
    updateEntryStatus: async (scope, entryId, nextStatus) => {
      if (scope !== workshopId || entryId !== entry.id) throw new Error("Lançamento financeiro não encontrado.");
      status = nextStatus;
    },
  };
  return { store, settlements, getStatus: () => status };
}

describe("financial settlements", () => {
  it("moves an entry through partial settlement and full payment", async () => {
    const state = settlementStore();
    const partial = await applyFinancialSettlement(state.store, {
      workshopId: "workshop-a",
      financialEntryId: "entry",
      amountCents: 4_000,
      settledAt: new Date("2026-10-26T12:00:00Z"),
    });
    expect(partial).toMatchObject({ status: "partial", balanceCents: 6_000 });
    expect(state.getStatus()).toBe("partial");

    const paid = await applyFinancialSettlement(state.store, {
      workshopId: "workshop-a",
      financialEntryId: "entry",
      amountCents: 6_000,
      settledAt: new Date("2026-10-27T12:00:00Z"),
    });
    expect(paid).toMatchObject({ status: "settled", balanceCents: 0 });
  });

  it("reopens the balance after reversing a settlement", async () => {
    const state = settlementStore();
    const settlement = await applyFinancialSettlement(state.store, {
      workshopId: "workshop-a",
      financialEntryId: "entry",
      amountCents: 10_000,
      settledAt: new Date("2026-10-26T12:00:00Z"),
    });
    const reversed = await reverseFinancialSettlement(state.store, {
      workshopId: "workshop-a",
      financialEntryId: "entry",
      settlementId: settlement.settlementId,
      reversedAt: new Date("2026-10-27T12:00:00Z"),
    });
    expect(reversed).toMatchObject({ status: "expected", balanceCents: 10_000 });
  });

  it("rejects overpayment and cannot access another workshop", async () => {
    const state = settlementStore();
    await expect(applyFinancialSettlement(state.store, {
      workshopId: "workshop-a",
      financialEntryId: "entry",
      amountCents: 10_001,
      settledAt: new Date(),
    })).rejects.toThrow("superar o saldo");
    await expect(applyFinancialSettlement(state.store, {
      workshopId: "workshop-b",
      financialEntryId: "entry",
      amountCents: 1,
      settledAt: new Date(),
    })).rejects.toThrow("não encontrado");
  });
});
