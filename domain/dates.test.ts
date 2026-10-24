import { describe, expect, it } from "vitest";
import { formatOptionalDate } from "./dates";

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
