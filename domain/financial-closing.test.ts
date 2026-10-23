import { describe, expect, it } from "vitest";
import { calculateFinancialClosing, type FinancialClosingInput } from "./financial-closing";

const base: FinancialClosingInput = {
  orderTotalCents: 15_000,
  taxBasisPoints: 600,
  payments: [
    { id: "pix", method: "pix", amountCents: 5_000, installmentCount: 1, percentageBasisPoints: 0, fixedFeeCents: 0, manualFeeCents: null },
    { id: "card", method: "credit_card", amountCents: 10_000, installmentCount: 2, percentageBasisPoints: 299, fixedFeeCents: 40, manualFeeCents: null },
  ],
  laborItems: [
    { id: "labor", grossCents: 10_000, discountCents: 1_000, assignments: [{ id: "assignment", collaboratorId: "collaborator", mode: "hybrid", participationBasisPoints: 5_000, commissionBasisPoints: 1_000, fixedPerServiceCents: 500 }] },
  ],
};

describe("financial closing", () => {
  it("reconciles split payments, card fees, tax reserve and labor-only compensation", () => {
    const closing = calculateFinancialClosing(base);
    expect(closing.payments).toEqual([
      expect.objectContaining({ id: "pix", feeAmountCents: 0, netAmountCents: 5_000 }),
      expect.objectContaining({ id: "card", feeAmountCents: 339, netAmountCents: 9_661 }),
    ]);
    expect(closing.taxReserveCents).toBe(900);
    expect(closing.assignments[0]).toEqual(expect.objectContaining({ laborBaseCents: 4_500, compensationCents: 950 }));
    expect(closing.netTotalCents).toBe(12_811);
  });

  it("uses the manual card fee instead of the configured rule", () => {
    const closing = calculateFinancialClosing({ ...base, payments: [{ ...base.payments[1], amountCents: 15_000, manualFeeCents: 700 }] });
    expect(closing.feeTotalCents).toBe(700);
  });

  it("rejects payments that do not equal the closed total", () => {
    expect(() => calculateFinancialClosing({ ...base, payments: [{ ...base.payments[0], amountCents: 14_999 }] })).toThrow("pagamentos");
  });

  it("rounds basis-point calculations to the nearest cent", () => {
    const closing = calculateFinancialClosing({ ...base, orderTotalCents: 101, taxBasisPoints: 333, payments: [{ ...base.payments[0], amountCents: 101 }] });
    expect(closing.taxReserveCents).toBe(3);
  });
});
