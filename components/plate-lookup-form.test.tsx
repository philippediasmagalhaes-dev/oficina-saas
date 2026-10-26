import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  canRequestPlateLookup,
  createPlateLookupRequest,
  plateLookupSuccessMessage,
  PlateLookupForm,
  resetPlateLookupMetadata,
} from "./plate-lookup-form";

const customers = [
  {
    id: "customer-1",
    workshopId: "workshop-1",
    name: "Cliente Teste",
    phone: null,
    email: null,
    notes: null,
    whatsappConsent: true,
    lastServiceAt: null,
    nextDueAt: null,
    serviceCount: 0,
    totalSpentCents: 0,
  },
];

describe("paid plate lookup safeguards", () => {
  it("ignores stale browser responses when requesting a plate", () => {
    const request = createPlateLookupRequest(
      "fry-4b58",
      "https://oficina-saas.contato-ad4.workers.dev",
    );

    expect(request.url).toBe(
      "https://oficina-saas.contato-ad4.workers.dev/api/veiculos/consultar-placa?plate=fry-4b58",
    );
    expect(request.cache).toBe("no-store");
  });

  it("blocks a repeated successful plate until the plate changes", () => {
    expect(canRequestPlateLookup("ABC1D23", "abc-1d23", "found")).toBe(false);
    expect(canRequestPlateLookup("ABC1D23", "DEF4G56", "idle")).toBe(true);
    expect(canRequestPlateLookup(null, "ABC", "idle")).toBe(false);
  });

  it("clears lookup metadata when the plate changes", () => {
    expect(resetPlateLookupMetadata("ABC1D23", "DEF4G56")).toEqual({
      lookupProvider: "",
      lookupSnapshot: "",
    });
    expect(resetPlateLookupMetadata("ABC1D23", "abc-1d23")).toBeNull();
  });

  it("distinguishes a free cache hit from a paid lookup", () => {
    expect(
      plateLookupSuccessMessage({ cached: true, balanceCents: null }),
    ).toBe("Dados reaproveitados do histórico, sem nova cobrança.");
    expect(
      plateLookupSuccessMessage({ cached: false, balanceCents: 2992 }),
    ).toBe("Consulta concluída. Saldo no provedor: R$ 29,92.");
  });

  it("keeps the lookup button simple without showing a per-query price", () => {
    const html = renderToStaticMarkup(<PlateLookupForm customers={customers} />);

    expect(html).toContain(">Consultar placa<");
    expect(html).not.toContain("Consultar por R$ 0,08");
  });
});
