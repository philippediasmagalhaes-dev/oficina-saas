import { describe, expect, it } from "vitest";
import {
  formatWorkOrderNumber,
  normalizeBrazilianDocument,
  normalizeBrazilianPhone,
  normalizePlate,
} from "./workshop-settings";

describe("workshop record normalization", () => {
  it("normalizes phone, document and plate without destroying display values", () => {
    expect(normalizeBrazilianPhone("(11) 97788-1220")).toBe("5511977881220");
    expect(normalizeBrazilianDocument("12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizePlate("fgy-0a18")).toBe("FGY0A18");
  });

  it("formats the stable workshop order number", () => {
    expect(formatWorkOrderNumber(1281)).toBe("OS Nº 1281");
  });
});
