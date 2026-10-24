import { describe, expect, it } from "vitest";
import { configuredPlateProvider, isPlateLookupCacheFresh, lookupPlate, mapPlateProviderResponse } from "./plate-lookup";

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

  it("maps FipePlaca fields and preserves its already masked chassis", () => {
    expect(
      mapPlateProviderResponse(
        {
          marca: "FIAT",
          modelo: "ARGO DRIVE 1.0",
          anoFabricacao: 2020,
          anoModelo: 2021,
          cor: "PRATA",
          municipio: "CAMPINAS",
          uf: "SP",
          cilindradas: 999,
          potencia: 77,
          combustivel: "ALCOOL / GASOLINA",
          chassi: "*************1234",
        },
        "ABC1D23",
      ),
    ).toEqual({
      plate: "ABC1D23",
      make: "FIAT",
      model: "ARGO DRIVE 1.0",
      color: "PRATA",
      manufactureYear: 2020,
      modelYear: 2021,
      fuel: "ALCOOL / GASOLINA",
      engineDisplacement: "999 cc",
      power: "77 cv",
      municipality: "CAMPINAS",
      state: "SP",
      maskedChassis: "*************1234",
    });
  });

  it("never exposes more than the final five chassis characters", () => {
    expect(
      mapPlateProviderResponse({
        marca: "VW",
        modelo: "GOL",
        chassi: "123456789012*ABCD",
      })?.maskedChassis,
    ).toBe("************\u002aABCD");
  });

  it("uses the FipePlaca endpoint, bearer token and returned balance", async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get("Authorization"),
      });
      return new Response(JSON.stringify({ marca: "VW", modelo: "GOL" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Saldo-Centavos": "2992" },
      });
    };
    const configured = configuredPlateProvider(
      {
        PLATE_LOOKUP_PROVIDER: "fipeplaca",
        PLATE_LOOKUP_API_TOKEN: "fp_live_test",
      } as unknown as NodeJS.ProcessEnv,
      fetcher,
    );

    const result = await lookupPlate(
      "ABC1D23",
      configured.provider,
      configured.name,
    );

    expect(calls).toEqual([
      {
        url: "https://api.fipeplaca.com.br/gateway/v1/placa/ABC1D23",
        authorization: "Bearer fp_live_test",
      },
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        status: "found",
        provider: "fipeplaca",
        balanceCents: 2992,
      }),
    );
  });

  it.each([
    [402, "SEM_SALDO", "unavailable", "Saldo"],
    [401, "CHAVE_INVALIDA", "unavailable", "configuração"],
    [404, "PLACA_NAO_ENCONTRADA", "not_found", "não foi encontrada"],
    [503, "FORNECEDOR_INDISPONIVEL", "unavailable", "temporariamente"],
  ])(
    "maps FipePlaca error %s/%s without retrying",
    async (statusCode, code, expectedStatus, messagePart) => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({ erro: { codigo: code, mensagem: "detalhe externo" } }),
          { status: statusCode, headers: { "Content-Type": "application/json" } },
        );
      };
      const configured = configuredPlateProvider(
        {
          PLATE_LOOKUP_PROVIDER: "fipeplaca",
          PLATE_LOOKUP_API_TOKEN: "fp_live_test",
        } as unknown as NodeJS.ProcessEnv,
        fetcher,
      );

      const result = await lookupPlate(
        "ABC1D23",
        configured.provider,
        configured.name,
      );

      expect(calls).toBe(1);
      expect(result.status).toBe(expectedStatus);
      expect(result).toEqual(
        expect.objectContaining({ message: expect.stringContaining(messagePart) }),
      );
      expect(JSON.stringify(result)).not.toContain("detalhe externo");
    },
  );

  it("redacts provider failures and keeps the manual fallback", async () => {
    const result = await lookupPlate("ABC1D23", async () => { throw new Error("token super-secret expired"); });
    expect(result).toEqual(expect.objectContaining({ status: "unavailable" }));
    expect(JSON.stringify(result)).not.toContain("super-secret");
  });

  it("reuses only a recent plate lookup", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    expect(isPlateLookupCacheFresh(new Date("2026-09-24T12:00:01Z"), now)).toBe(true);
    expect(isPlateLookupCacheFresh(new Date("2026-09-24T11:59:59Z"), now)).toBe(false);
    expect(isPlateLookupCacheFresh(null, now)).toBe(false);
  });

  it("marks a live provider result as billable rather than cached", async () => {
    const result = await lookupPlate("ABC1D23", async () => ({
      payload: { marca: "VW", modelo: "GOL" },
      balanceCents: 2992,
    }), "fipeplaca");

    expect(result).toEqual(
      expect.objectContaining({ status: "found", cached: false, balanceCents: 2992 }),
    );
  });
});
