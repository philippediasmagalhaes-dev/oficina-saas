import { describe, expect, it } from "vitest";
import { lookupPlate, mapPlateProviderResponse } from "./plate-lookup";

describe("plate lookup", () => {
  it("normalizes the plate before calling the provider", async () => {
    let received = "";
    const result = await lookupPlate("abc-1d23", async (plate) => { received = plate; return { marca: "Chevrolet", modelo: "Onix" }; });
    expect(received).toBe("ABC1D23");
    expect(result.status).toBe("found");
  });

  it("remains available for manual entry when disabled", async () => {
    expect(await lookupPlate("ABC1D23", null)).toEqual(expect.objectContaining({ status: "unavailable" }));
  });

  it("maps common provider field names", () => {
    expect(mapPlateProviderResponse({ MARCA: "VW", modelo: "Gol", anoFabricacao: "2018", anoModelo: 2019, municipio: "São Paulo", uf: "SP", chassi: "9BW123456789" })).toEqual(expect.objectContaining({ make: "VW", model: "Gol", manufactureYear: 2018, modelYear: 2019, municipality: "São Paulo", state: "SP", maskedChassis: "*******56789" }));
  });

  it("redacts provider failures and keeps the manual fallback", async () => {
    const result = await lookupPlate("ABC1D23", async () => { throw new Error("token super-secret expired"); });
    expect(result).toEqual(expect.objectContaining({ status: "unavailable" }));
    expect(JSON.stringify(result)).not.toContain("super-secret");
  });
});
