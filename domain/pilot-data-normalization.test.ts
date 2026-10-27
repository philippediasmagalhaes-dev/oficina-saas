import { describe, expect, it } from "vitest";
import { distributeMissingCompletionDates } from "./pilot-data-normalization";

describe("pilot data normalization", () => {
  it("distributes missing orders evenly across previous months", () => {
    const assignments = distributeMissingCompletionDates(
      Array.from({ length: 25 }, (_, index) => `order-${String(index).padStart(2, "0")}`),
      new Date("2026-10-27T12:00:00Z"),
    );
    const months = new Map<string, number>();
    for (const date of assignments.values()) {
      const key = date.toISOString().slice(0, 7);
      months.set(key, (months.get(key) ?? 0) + 1);
      expect(date.getTime()).toBeLessThan(new Date("2026-10-01T00:00:00Z").getTime());
    }
    expect(months.size).toBe(12);
    expect(Math.max(...months.values()) - Math.min(...months.values())).toBeLessThanOrEqual(1);
  });

  it("is deterministic regardless of input order", () => {
    const anchor = new Date("2026-10-27T12:00:00Z");
    const first = distributeMissingCompletionDates(["b", "a", "c"], anchor);
    const second = distributeMissingCompletionDates(["c", "b", "a"], anchor);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it("returns no assignments when every order already has a date", () => {
    expect(distributeMissingCompletionDates([], new Date("2026-10-27T12:00:00Z"))).toEqual(new Map());
  });
});
