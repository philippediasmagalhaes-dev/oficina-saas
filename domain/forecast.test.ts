import { describe, expect, it } from "vitest";
import {
  classifyCustomer,
  deriveNextDueAt,
  deriveNextDueDateValue,
} from "./forecast";

describe("customer forecast", () => {
  it.each([
    [{ nextDueAt: "2026-10-10", lastServiceAt: "2026-09-01" }, "upcoming"],
    [{ nextDueAt: "2026-09-01", lastServiceAt: "2026-08-01" }, "overdue"],
    [{ nextDueAt: null, lastServiceAt: "2025-01-01" }, "inactive"],
    [{ nextDueAt: null, lastServiceAt: null }, "current"],
  ] as const)("classifies %o as %s", (history, expected) => {
    expect(
      classifyCustomer(
        { ...history, inactivityDays: 180 },
        new Date("2026-09-20T12:00:00Z"),
      ),
    ).toBe(expected);
  });

  it("keeps a due date beyond 30 days current", () => {
    expect(
      classifyCustomer(
        {
          nextDueAt: "2026-11-01",
          lastServiceAt: "2026-09-01",
          inactivityDays: 180,
        },
        new Date("2026-09-20T12:00:00Z"),
      ),
    ).toBe("current");
  });

  it("derives a due date from the completed date and interval", () => {
    expect(
      deriveNextDueAt(new Date("2026-09-20T12:00:00Z"), 180)?.toISOString(),
    ).toBe("2027-03-19T12:00:00.000Z");
    expect(deriveNextDueAt(new Date("2026-09-20T12:00:00Z"), null)).toBeNull();
  });

  it("formats the derived date for a date input", () => {
    expect(deriveNextDueDateValue("2026-09-20", 180)).toBe("2027-03-19");
    expect(deriveNextDueDateValue("2026-09-20", null)).toBe("");
    expect(deriveNextDueDateValue("invalid", 30)).toBe("");
  });
});
