import { describe, expect, it, vi } from "vitest";
import { formatMoneyInput, selectMoneyInputValue } from "./money-input";

describe("Brazilian money input", () => {
  it("formats typed digits as cents using a comma", () => {
    expect(formatMoneyInput("1")).toBe("0,01");
    expect(formatMoneyInput("1234")).toBe("12,34");
    expect(formatMoneyInput("R$ 1.234,56")).toBe("1.234,56");
  });

  it("selects the complete value on focus", () => {
    const select = vi.fn();
    selectMoneyInputValue({ select });
    expect(select).toHaveBeenCalledOnce();
  });
});

