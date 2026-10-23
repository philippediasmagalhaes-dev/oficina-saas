import { describe, expect, it } from "vitest";
import { normalizeInspection } from "./inspection";

describe("vehicle intake inspection", () => {
  it("keeps the checklist and normalized damage coordinates", () => {
    expect(normalizeInspection({
      odometer: 120000,
      fuelLevel: "half",
      tireCondition: "good",
      checklist: { spareKey: true, documents: false },
      observations: "Risco na porta",
      marks: [{ vehicleView: "left", xBasisPoints: 2500, yBasisPoints: 5000, damageType: "scratch", note: "Porta" }],
    })).toEqual({
      odometer: 120000,
      fuelLevel: "half",
      tireCondition: "good",
      checklist: { spareKey: true, documents: false },
      observations: "Risco na porta",
      marks: [{ vehicleView: "left", xBasisPoints: 2500, yBasisPoints: 5000, damageType: "scratch", note: "Porta" }],
    });
  });

  it("rejects marks outside the vehicle drawing", () => {
    expect(() => normalizeInspection({ odometer: null, fuelLevel: null, tireCondition: null, checklist: {}, observations: null, marks: [{ vehicleView: "top", xBasisPoints: 10001, yBasisPoints: 0, damageType: "dent", note: null }] })).toThrow("Posição de avaria inválida");
  });
});
