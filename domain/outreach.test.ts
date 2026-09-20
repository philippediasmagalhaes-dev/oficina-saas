import { describe, expect, it } from "vitest";
import { buildWhatsAppDraft } from "./outreach";

const base = { phone: "11999999999", consent: true, customer: "Ana", workshop: "Oficina" };

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
});
