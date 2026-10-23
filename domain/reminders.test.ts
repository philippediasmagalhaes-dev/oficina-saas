import { describe, expect, it } from "vitest";
import { buildReminderCandidate } from "./reminders";

const base = { workshopId: "workshop", workshopName: "Paulinho Autocar", customerId: "customer", customerName: "Ana", phone: "(11) 99999-0000", whatsappConsent: true, whatsappOptOutAt: null, serviceRecordId: "order", nextDueAt: new Date("2026-10-30T12:00:00Z"), lastReminderAt: null };

describe("WhatsApp reminder candidates", () => {
  it.each([
    ["2026-10-23T13:00:00Z", "maintenance_due_7d"],
    ["2026-10-30T13:00:00Z", "maintenance_due_today"],
    ["2026-11-13T13:00:00Z", "maintenance_overdue_14d"],
  ])("creates the deterministic due schedule", (now, purpose) => {
    expect(buildReminderCandidate(base, new Date(now))).toEqual(expect.objectContaining({ purpose, idempotencyKey: expect.stringContaining(`${purpose}:2026-10-30`) }));
  });

  it("requires consent and rejects opted-out contacts", () => {
    expect(buildReminderCandidate({ ...base, whatsappConsent: false }, new Date("2026-10-23T13:00:00Z"))).toBeNull();
    expect(buildReminderCandidate({ ...base, whatsappOptOutAt: new Date() }, new Date("2026-10-23T13:00:00Z"))).toBeNull();
  });

  it("honors cooldown and schedules outside quiet hours", () => {
    expect(buildReminderCandidate({ ...base, lastReminderAt: new Date("2026-10-21T13:00:00Z") }, new Date("2026-10-23T13:00:00Z"))).toBeNull();
    expect(buildReminderCandidate(base, new Date("2026-10-23T09:00:00Z"))?.scheduledAt.toISOString()).toBe("2026-10-23T11:00:00.000Z");
  });
});
