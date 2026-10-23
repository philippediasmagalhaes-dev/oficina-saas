import { describe, expect, it } from "vitest";
import { runIdempotentInventoryOperation, type InventoryOperationStore } from "./inventory";

describe("inventory operation idempotency", () => {
  it("applies a reservation key only once", async () => {
    const applied: string[] = [];
    const keys = new Set<string>();
    const store: InventoryOperationStore = {
      has: async (key) => keys.has(key),
      apply: async (operation) => { applied.push(operation.operationKey); keys.add(operation.operationKey); },
    };
    const operation = { operationKey: "reserve:order-a:item-a", quantityDelta: 0, reservationDelta: 2 };
    expect(await runIdempotentInventoryOperation(store, operation)).toBe("applied");
    expect(await runIdempotentInventoryOperation(store, operation)).toBe("duplicate");
    expect(applied).toEqual([operation.operationKey]);
  });
});
