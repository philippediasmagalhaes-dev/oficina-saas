import { describe, expect, it } from "vitest";
import {
  calculateEntryBalance,
  deriveEntryStatus,
  splitInstallments,
} from "./financial-ledger";

describe("operational financial ledger", () => {
  it("keeps reversed settlements out of the outstanding balance", () => {
    expect(
      calculateEntryBalance(10_000, [
        { amountCents: 4_000, reversedAt: null },
        { amountCents: 2_000, reversedAt: new Date("2026-10-25T12:00:00Z") },
      ]),
    ).toEqual({ settledCents: 4_000, balanceCents: 6_000 });
  });

  it("derives expected, partial, settled and cancelled states from real balances", () => {
    expect(deriveEntryStatus(10_000, 10_000, false)).toBe("expected");
    expect(deriveEntryStatus(10_000, 6_000, false)).toBe("partial");
    expect(deriveEntryStatus(10_000, 0, false)).toBe("settled");
    expect(deriveEntryStatus(10_000, 10_000, true)).toBe("cancelled");
  });

  it("rejects settlement totals greater than the title", () => {
    expect(() =>
      calculateEntryBalance(5_000, [
        { amountCents: 5_001, reversedAt: null },
      ]),
    ).toThrow("saldo");
  });

  it("splits cents exactly and keeps monthly due dates anchored", () => {
    expect(splitInstallments(10_000, 3, new Date("2026-01-31T12:00:00Z"))).toEqual([
      { installmentNumber: 1, installmentCount: 3, amountCents: 3_334, dueDate: new Date("2026-01-31T12:00:00Z") },
      { installmentNumber: 2, installmentCount: 3, amountCents: 3_333, dueDate: new Date("2026-02-28T12:00:00Z") },
      { installmentNumber: 3, installmentCount: 3, amountCents: 3_333, dueDate: new Date("2026-03-31T12:00:00Z") },
    ]);
  });

  it("rejects zero values and invalid installment counts", () => {
    expect(() => splitInstallments(0, 2, new Date())).toThrow("valor");
    expect(() => splitInstallments(100, 0, new Date())).toThrow("parcelas");
  });
});
