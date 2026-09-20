import { describe, expect, it } from "vitest";
import { formatCents, parseCurrencyToCents } from "./money";

describe("money", () => {
  it("parses Brazilian currency without floating point drift", () => {
    expect(parseCurrencyToCents("1.234,56")).toBe(123456);
    expect(parseCurrencyToCents("50")).toBe(5000);
  });

  it("rejects invalid or negative values", () => {
    expect(() => parseCurrencyToCents("-1,00")).toThrow("Valor inválido");
    expect(() => parseCurrencyToCents("abc")).toThrow("Valor inválido");
  });

  it("formats cents as BRL", () => {
    expect(formatCents(123456)).toContain("1.234,56");
  });
});
