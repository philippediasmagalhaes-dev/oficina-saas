import { describe, expect, it } from "vitest";
import { allocateCentsProportionally, formatCents, parseCurrencyToCents } from "./money";

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

  it("allocates cents exactly without negative remainders", () => {
    expect(allocateCentsProportionally(2, [10_000, 10_000, 10_000, 10_000])).toEqual([1, 1, 0, 0]);
    expect(allocateCentsProportionally(7, [100, 200, 300])).toEqual([1, 2, 4]);
    expect(allocateCentsProportionally(0, [10, 20])).toEqual([0, 0]);
  });
});
