import { describe, expect, it } from "vitest";
import {
  buildQuoteDraft,
  buildServiceReadyDraft,
  buildWorkOrderDraft,
  buildWhatsAppDraft,
} from "./outreach";

const base = {
  phone: "11999999999",
  consent: true,
  customer: "Ana",
  workshop: "Oficina",
};

describe("WhatsApp outreach", () => {
  it("requires explicit consent", () => {
    expect(buildWhatsAppDraft({ ...base, consent: false })).toBeNull();
  });

  it("requires a valid Brazilian phone", () => {
    expect(buildWhatsAppDraft({ ...base, phone: "123" })).toBeNull();
  });

  it("creates an encoded assisted message", () => {
    const draft = buildWhatsAppDraft(base);
    expect(draft?.url).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
    expect(draft?.message).toContain("Ana");
    expect(draft?.message).toContain("Oficina");
  });

  it("creates a ready-for-pickup message with the vehicle", () => {
    const draft = buildServiceReadyDraft({
      ...base,
      vehicle: "Honda Civic · ABC1D23",
    });
    expect(draft?.message).toContain("está pronto");
    expect(draft?.message).toContain("Honda Civic · ABC1D23");
    expect(draft?.url).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
  });

  it("does not create a ready notice without consent", () => {
    expect(buildServiceReadyDraft({ ...base, consent: false })).toBeNull();
  });

  it("creates a digital quote message", () => {
    const draft = buildQuoteDraft({
      ...base,
      vehicle: "Honda Civic",
      total: "R$ 800,00",
      quoteUrl: "https://example.com/orcamento/token",
    });
    expect(draft?.message).toContain("R$ 800,00");
    expect(draft?.message).toContain("/orcamento/token");
  });

  it("creates a work-order message with status, total, and secure link", () => {
    const draft = buildWorkOrderDraft({
      ...base,
      vehicle: "Honda Civic · ABC1D23",
      orderNumber: "OS 001281",
      status: "Pronto para entrega",
      total: "R$ 800,00",
      orderUrl: "https://example.com/orcamento/token",
    });

    expect(draft?.message).toContain("OS 001281");
    expect(draft?.message).toContain("Pronto para entrega");
    expect(draft?.message).toContain("R$ 800,00");
    expect(draft?.message).toContain("/orcamento/token");
  });
});
