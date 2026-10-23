import { describe, expect, it } from "vitest";
import { createWhatsAppProvider, queueReminderCandidates, verifyWebhookChallenge, type ReminderQueueStore } from "./whatsapp";

describe("WhatsApp automation", () => {
  it("does not configure delivery without all required credentials", () => {
    expect(createWhatsAppProvider({}).enabled).toBe(false);
  });

  it("queues an idempotency key only once", async () => {
    const keys = new Set<string>();
    const store: ReminderQueueStore = { enqueue: async (candidate) => { if (keys.has(candidate.idempotencyKey)) return false; keys.add(candidate.idempotencyKey); return true; } };
    const candidate = { workshopId: "w", customerId: "c", serviceRecordId: "s", recipientPhone: "5511999990000", purpose: "maintenance_due_today" as const, idempotencyKey: "same", scheduledAt: new Date(), payload: {} };
    expect(await queueReminderCandidates(store, [candidate, candidate])).toBe(1);
  });

  it("validates webhook challenges without exposing the token", () => {
    expect(verifyWebhookChallenge(new URL("https://x.test?hub.mode=subscribe&hub.verify_token=ok&hub.challenge=123"), "ok")).toEqual({ ok: true, challenge: "123" });
    expect(verifyWebhookChallenge(new URL("https://x.test?hub.mode=subscribe&hub.verify_token=secret&hub.challenge=123"), "ok")).toEqual({ ok: false });
  });
});
