import { describe, expect, it } from "vitest";
import { nextWorkOrderNumber, type WorkOrderSequenceStore } from "./work-order-number";

describe("work order number allocation", () => {
  it("returns each number allocated by the tenant sequence", async () => {
    let next = 1;
    const store: WorkOrderSequenceStore = {
      async allocate(workshopId) {
        expect(workshopId).toBe("workshop-a");
        return next++;
      },
    };

    const numbers = await Promise.all([
      nextWorkOrderNumber(store, "workshop-a"),
      nextWorkOrderNumber(store, "workshop-a"),
      nextWorkOrderNumber(store, "workshop-a"),
    ]);

    expect(numbers).toEqual([1, 2, 3]);
  });

  it("rejects an invalid sequence result instead of creating a malformed OS", async () => {
    const store: WorkOrderSequenceStore = { allocate: async () => 0 };
    await expect(nextWorkOrderNumber(store, "workshop-a")).rejects.toThrow("Número de OS inválido");
  });
});
