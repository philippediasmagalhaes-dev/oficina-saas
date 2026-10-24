import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  canRequestPlateLookup,
  plateLookupSuccessMessage,
  PlateLookupForm,
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
  it("blocks a repeated successful plate until the plate changes", () => {
    expect(canRequestPlateLookup("ABC1D23", "abc-1d23", "found")).toBe(false);
    expect(canRequestPlateLookup("ABC1D23", "DEF4G56", "idle")).toBe(true);
    expect(canRequestPlateLookup(null, "ABC", "idle")).toBe(false);
  });

  it("distinguishes a free cache hit from a paid lookup", () => {
    expect(
      plateLookupSuccessMessage({ cached: true, balanceCents: null }),
    ).toBe("Dados reaproveitados do histórico, sem nova cobrança.");
    expect(
      plateLookupSuccessMessage({ cached: false, balanceCents: 2992 }),
    ).toBe("Consulta concluída por R$ 0,08. Saldo no provedor: R$ 29,92.");
  });

  it("makes the price visible before the owner requests a lookup", () => {
    const html = renderToStaticMarkup(<PlateLookupForm customers={customers} />);

    expect(html).toContain("Consultar por R$ 0,08");
  });
});
