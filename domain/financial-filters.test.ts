import { describe, expect, it } from "vitest";
import { normalizeFinancialFilters } from "./financial-filters";

describe("financial filters", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");

  it("normalizes pagination and protects the maximum page size", () => {
    expect(normalizeFinancialFilters({ page: "0", pageSize: "500" }, now)).toMatchObject({
      page: 1,
      pageSize: 100,
      offset: 0,
    });
    expect(normalizeFinancialFilters({ page: "3", pageSize: "25" }, now)).toMatchObject({
      page: 3,
      pageSize: 25,
      offset: 50,
    });
  });

  it("creates deterministic due-date windows", () => {
    expect(normalizeFinancialFilters({ due: "overdue" }, now)).toMatchObject({
      dueFrom: undefined,
      dueTo: new Date("2026-10-26T00:00:00.000Z"),
    });
    expect(normalizeFinancialFilters({ due: "today" }, now)).toMatchObject({
      dueFrom: new Date("2026-10-26T00:00:00.000Z"),
      dueTo: new Date("2026-10-27T00:00:00.000Z"),
    });
    expect(normalizeFinancialFilters({ due: "next_30_days" }, now)).toMatchObject({
      dueFrom: new Date("2026-10-26T00:00:00.000Z"),
      dueTo: new Date("2026-11-25T00:00:00.000Z"),
    });
  });

  it("accepts only supported directions and statuses", () => {
    expect(normalizeFinancialFilters({ direction: "expense", status: "partial" }, now)).toMatchObject({
      direction: "expense",
      status: "partial",
    });
    expect(normalizeFinancialFilters({ direction: "invalid", status: "invalid" }, now)).toMatchObject({
      direction: undefined,
      status: undefined,
    });
  });
});
