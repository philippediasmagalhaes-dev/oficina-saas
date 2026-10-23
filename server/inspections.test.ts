import { describe, expect, it } from "vitest";
import { persistInspection, type InspectionStore } from "./inspections";

describe("inspection persistence boundary", () => {
  it("replaces only the authenticated workshop order inspection", async () => {
    const writes: unknown[] = [];
    const store: InspectionStore = {
      replace: async (input) => {
        writes.push(input);
        return { id: "inspection-a" };
      },
    };
    const result = await persistInspection(store, {
      workshopId: "workshop-a",
      serviceRecordId: "order-a",
      odometer: 120000,
      fuelLevel: "half",
      tireCondition: "good",
      checklist: { documents: true },
      observations: null,
      marks: [],
    });
    expect(result).toEqual({ id: "inspection-a" });
    expect(writes).toEqual([expect.objectContaining({ workshopId: "workshop-a", serviceRecordId: "order-a" })]);
  });
});
