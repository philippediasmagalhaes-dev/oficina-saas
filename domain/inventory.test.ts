import { describe, expect, it } from "vitest";
import { applyStockDelta } from "./inventory";

describe("inventory", () => {
  it("applies entries and consumption", () => {
    expect(applyStockDelta(2, 3)).toBe(5);
    expect(applyStockDelta(5, -2)).toBe(3);
  });

  it("rejects negative stock", () => {
    expect(() => applyStockDelta(2, -3)).toThrow("Estoque insuficiente");
  });

  it("rejects non-integer quantities", () => {
    expect(() => applyStockDelta(2, 0.5)).toThrow("Quantidade inválida");
  });
});
