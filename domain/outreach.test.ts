import { describe, expect, it } from "vitest";
import { buildServiceReadyDraft, buildWhatsAppDraft } from "./outreach";

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
});
