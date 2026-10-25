import { describe, expect, it } from "vitest";
import { formatOptionalDate, parseMonthPeriod } from "./dates";

describe("optional dates", () => {
  it("shows that a missing historical date was not informed", () => {
    expect(formatOptionalDate(null)).toBe("Data não informada");
  });

  it("formats a known date in Brazilian notation", () => {
    expect(formatOptionalDate(new Date("2025-06-01T12:00:00.000Z"))).toBe(
      "01/06/2025",
    );
  });
});

describe("monthly period", () => {
  it("builds an exclusive UTC range for a selected month", () => {
    expect(parseMonthPeriod("2026-02", new Date("2026-10-25T12:00:00Z"))).toEqual({
      value: "2026-02",
      label: "fevereiro de 2026",
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-03-01T00:00:00.000Z"),
    });
  });

  it("falls back to the current month for invalid input", () => {
    expect(parseMonthPeriod("2026-13", new Date("2026-10-25T12:00:00Z")).value).toBe("2026-10");
  });
});
