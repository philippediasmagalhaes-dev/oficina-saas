import { describe, expect, it } from "vitest";
import { calculateAssignmentCompensation, hasMonthlyCompensation, validateParticipationTotal } from "./commissions";

describe("collaborator compensation", () => {
  it("calculates percentage only from discounted labor and participation", () => {
    expect(calculateAssignmentCompensation({ mode: "percentage", discountedLaborCents: 10000, participationBasisPoints: 5000, commissionBasisPoints: 2000, fixedPerServiceCents: 0 })).toEqual({ laborBaseCents: 5000, commissionCents: 1000, fixedPerServiceCents: 0, totalCents: 1000 });
  });

  it("supports fixed-per-service and hybrid compensation", () => {
    expect(calculateAssignmentCompensation({ mode: "fixed_per_service", discountedLaborCents: 10000, participationBasisPoints: 10000, commissionBasisPoints: 0, fixedPerServiceCents: 2500 }).totalCents).toBe(2500);
    expect(calculateAssignmentCompensation({ mode: "hybrid", discountedLaborCents: 10000, participationBasisPoints: 10000, commissionBasisPoints: 1000, fixedPerServiceCents: 2500 }).totalCents).toBe(3500);
  });

  it("does not duplicate monthly fixed pay on service assignments", () => {
    expect(calculateAssignmentCompensation({ mode: "fixed_monthly", discountedLaborCents: 10000, participationBasisPoints: 10000, commissionBasisPoints: 1000, fixedPerServiceCents: 2500 }).totalCents).toBe(0);
  });

  it("rejects total participation above one hundred percent", () => {
    expect(validateParticipationTotal([5000, 5000])).toBe(10000);
    expect(() => validateParticipationTotal([6000, 5000])).toThrow("Participação total não pode ultrapassar 100%");
  });

  it("rounds participation and commission only once", () => {
    expect(calculateAssignmentCompensation({ mode: "percentage", discountedLaborCents: 101, participationBasisPoints: 5000, commissionBasisPoints: 5000, fixedPerServiceCents: 0 })).toEqual({ laborBaseCents: 51, commissionCents: 25, fixedPerServiceCents: 0, totalCents: 25 });
  });

  it("includes monthly pay for fixed and hybrid collaborators", () => {
    expect(hasMonthlyCompensation("fixed_monthly")).toBe(true);
    expect(hasMonthlyCompensation("hybrid")).toBe(true);
    expect(hasMonthlyCompensation("percentage")).toBe(false);
  });
});
