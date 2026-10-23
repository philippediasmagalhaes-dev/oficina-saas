import { describe, expect, it } from "vitest";
import { applyReservation, applyReservedConsumption, applyStockDelta } from "./inventory";

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

  it("reserves only available stock and releases it safely", () => {
    expect(applyReservation({ current: 10, reserved: 2 }, 5)).toEqual({ current: 10, reserved: 7, available: 3 });
    expect(applyReservation({ current: 10, reserved: 7 }, -4)).toEqual({ current: 10, reserved: 3, available: 7 });
    expect(() => applyReservation({ current: 10, reserved: 8 }, 3)).toThrow("Estoque disponível insuficiente");
  });

  it("turns a reservation into consumption exactly once", () => {
    expect(applyReservedConsumption({ current: 10, reserved: 4 }, 3)).toEqual({ current: 7, reserved: 1, available: 6 });
    expect(() => applyReservedConsumption({ current: 10, reserved: 2 }, 3)).toThrow("Reserva insuficiente");
  });
});
