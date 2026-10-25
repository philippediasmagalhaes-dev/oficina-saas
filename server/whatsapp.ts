import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { customers, messageDeliveries, messageOutbox, serviceRecords, workshops } from "../db/schema";
import { buildReminderCandidate, type ReminderCandidate } from "../domain/reminders";
import { normalizeBrazilianPhone } from "../domain/outreach";

export interface ReminderQueueStore { enqueue(candidate: ReminderCandidate): Promise<boolean> }

export function getConfiguredWhatsAppWorkshopId(env: Record<string, string | undefined>) {
  return env.WHATSAPP_WORKSHOP_ID?.trim() || null;
}

export function normalizeReadyRecipient(input: { consent: boolean; phone: string | null }) {
  return input.consent && input.phone
    ? normalizeBrazilianPhone(input.phone)
    : null;
}

export async function queueReminderCandidates(store: ReminderQueueStore, candidates: ReminderCandidate[]) {
  let inserted = 0;
  for (const candidate of candidates) if (await store.enqueue(candidate)) inserted += 1;
  return inserted;
}

export function createDrizzleReminderQueueStore(): ReminderQueueStore {
  return { async enqueue(candidate) {
    const rows = await getDatabase().insert(messageOutbox).values({ ...candidate, templateName: process.env.WHATSAPP_REMINDER_TEMPLATE_NAME ?? null }).onConflictDoNothing().returning({ id: messageOutbox.id });
    return rows.length > 0;
  } };
}

export type WhatsAppProvider = { enabled: boolean; send(candidate: { recipientPhone: string; templateName: string | null; payload: Record<string, unknown> }): Promise<{ providerMessageId: string }> };

export function createWhatsAppProvider(env: Record<string, string | undefined>, request: typeof fetch = fetch): WhatsAppProvider {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) return { enabled: false, send: async () => { throw new Error("WhatsApp não configurado."); } };
  return { enabled: true, async send(candidate) {
    const name = candidate.templateName;
    if (!name) throw new Error("template_not_configured");
    const response = await request(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: candidate.recipientPhone, type: "template", template: { name, language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: String(candidate.payload.customerName ?? "cliente") }, { type: "text", text: String(candidate.payload.workshopName ?? "oficina") }, { type: "text", text: String(candidate.payload.dueDate ?? candidate.payload.vehicleLabel ?? "") }] }] } }) });
    if (!response.ok) throw new Error(`provider_${response.status}`);
    const body = await response.json() as { messages?: Array<{ id?: string }> };
    const providerMessageId = body.messages?.[0]?.id;
    if (!providerMessageId) throw new Error("provider_invalid_response");
    return { providerMessageId };
  } };
}

export function verifyWebhookChallenge(url: URL, expectedToken: string | undefined): { ok: true; challenge: string } | { ok: false } {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  return expectedToken && mode === "subscribe" && token === expectedToken && challenge ? { ok: true, challenge } : { ok: false };
}

export async function scheduleMaintenanceReminders(now = new Date()) {
  const workshopId = getConfiguredWhatsAppWorkshopId(process.env);
  if (!process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || !workshopId) return 0;
  const database = getDatabase();
  const [rows, previous] = await Promise.all([
    database.select({ workshopId: serviceRecords.workshopId, workshopName: workshops.name, customerId: serviceRecords.customerId, customerName: customers.name, phone: customers.phone, whatsappConsent: customers.whatsappConsent, whatsappOptOutAt: customers.whatsappOptOutAt, serviceRecordId: serviceRecords.id, nextDueAt: serviceRecords.nextDueAt }).from(serviceRecords).innerJoin(customers, and(eq(customers.id, serviceRecords.customerId), eq(customers.workshopId, serviceRecords.workshopId))).innerJoin(workshops, eq(workshops.id, serviceRecords.workshopId)).where(and(eq(serviceRecords.workshopId, workshopId), inArray(serviceRecords.status, ["completed", "delivered"]), eq(customers.whatsappConsent, true))),
    database.select({ serviceRecordId: messageOutbox.serviceRecordId, sentAt: messageOutbox.sentAt, createdAt: messageOutbox.createdAt }).from(messageOutbox).where(and(eq(messageOutbox.workshopId, workshopId), inArray(messageOutbox.status, ["sent", "delivered", "read"]))).orderBy(desc(messageOutbox.createdAt)),
  ]);
  const latest = new Map<string, Date>();
  for (const row of previous) if (row.serviceRecordId && !latest.has(row.serviceRecordId)) latest.set(row.serviceRecordId, row.sentAt ?? row.createdAt);
  const candidates = rows.flatMap((row) => row.nextDueAt ? [buildReminderCandidate({ ...row, nextDueAt: row.nextDueAt, lastReminderAt: latest.get(row.serviceRecordId) ?? null }, now)].filter((candidate): candidate is ReminderCandidate => candidate !== null) : []);
  return queueReminderCandidates(createDrizzleReminderQueueStore(), candidates);
}

export async function processWhatsAppOutbox(now = new Date()) {
  const provider = createWhatsAppProvider(process.env);
  const workshopId = getConfiguredWhatsAppWorkshopId(process.env);
  if (!provider.enabled || !workshopId) return { enabled: false, sent: 0, failed: 0 };
  const database = getDatabase();
  await database.update(messageOutbox).set({ status: "failed", lastError: "Envio interrompido em estado incerto. Use o envio manual para evitar duplicidade.", updatedAt: now }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.status, "processing"), lte(messageOutbox.updatedAt, new Date(now.getTime() - 15 * 60_000))));
  const rows = await database.select({ id: messageOutbox.id }).from(messageOutbox).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.status, "pending"), lte(messageOutbox.scheduledAt, now))).orderBy(messageOutbox.scheduledAt).limit(50);
  let sent = 0; let failed = 0;
  for (const candidate of rows) {
    const [row] = await database.update(messageOutbox).set({ status: "processing", updatedAt: now }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.id, candidate.id), eq(messageOutbox.status, "pending"))).returning();
    if (!row) continue;
    const [customer] = await database.select({ consent: customers.whatsappConsent, optedOutAt: customers.whatsappOptOutAt }).from(customers).where(and(eq(customers.workshopId, workshopId), eq(customers.id, row.customerId))).limit(1);
    if (!customer?.consent || customer.optedOutAt) {
      await database.update(messageOutbox).set({ status: "cancelled", lastError: "Consentimento revogado.", updatedAt: now }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.id, row.id), eq(messageOutbox.status, "processing")));
      continue;
    }
    let acceptedByProvider = false;
    try {
      const result = await provider.send(row);
      acceptedByProvider = true;
      await database.update(messageOutbox).set({ status: "sent", providerMessageId: result.providerMessageId, sentAt: now, attempts: row.attempts + 1, lastError: null, updatedAt: now }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.id, row.id), eq(messageOutbox.status, "processing")));
      await database.insert(messageDeliveries).values({ workshopId: row.workshopId, outboxId: row.id, providerMessageId: result.providerMessageId, status: "sent", occurredAt: now });
      sent += 1;
    } catch {
      const nextAttempt = new Date(now.getTime() + 15 * 60_000);
      await database.update(messageOutbox).set({ status: acceptedByProvider || row.attempts >= 4 ? "failed" : "pending", attempts: row.attempts + 1, lastError: acceptedByProvider ? "Envio aceito; confirmação local pendente. Não reenviar automaticamente." : "Falha temporária no provedor.", scheduledAt: nextAttempt, updatedAt: now }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.id, row.id), eq(messageOutbox.status, "processing")));
      failed += 1;
    }
  }
  return { enabled: true, sent, failed };
}

export async function getWhatsAppAutomationStatus(workshopId: string) {
  const rows = await getDatabase().select({ status: messageOutbox.status, purpose: messageOutbox.purpose, scheduledAt: messageOutbox.scheduledAt, sentAt: messageOutbox.sentAt, lastError: messageOutbox.lastError }).from(messageOutbox).where(eq(messageOutbox.workshopId, workshopId)).orderBy(desc(messageOutbox.createdAt)).limit(20);
  return { configured: createWhatsAppProvider(process.env).enabled && getConfiguredWhatsAppWorkshopId(process.env) === workshopId && Boolean(process.env.WHATSAPP_REMINDER_TEMPLATE_NAME), rows, counts: { pending: rows.filter((row) => ["pending", "processing"].includes(row.status)).length, sent: rows.filter((row) => ["sent", "delivered", "read"].includes(row.status)).length, failed: rows.filter((row) => row.status === "failed").length } };
}

export async function enqueueVehicleReadyMessage(input: { workshopId: string; customerId: string; serviceRecordId: string; recipientPhone: string; customerName: string; workshopName: string; vehicleLabel: string | null }) {
  const templateName = process.env.WHATSAPP_READY_TEMPLATE_NAME?.trim();
  if (!templateName || !createWhatsAppProvider(process.env).enabled || getConfiguredWhatsAppWorkshopId(process.env) !== input.workshopId) return false;
  const database = getDatabase();
  await database.insert(messageOutbox).values({ workshopId: input.workshopId, customerId: input.customerId, serviceRecordId: input.serviceRecordId, idempotencyKey: `vehicle-ready:${input.serviceRecordId}`, purpose: "vehicle_ready", recipientPhone: input.recipientPhone, templateName, payload: { customerName: input.customerName, workshopName: input.workshopName, vehicleLabel: input.vehicleLabel ?? "veículo" }, scheduledAt: new Date() }).onConflictDoNothing();
  await processWhatsAppOutbox();
  const [outbox] = await database.select({ status: messageOutbox.status }).from(messageOutbox).where(and(eq(messageOutbox.workshopId, input.workshopId), eq(messageOutbox.idempotencyKey, `vehicle-ready:${input.serviceRecordId}`))).limit(1);
  return Boolean(outbox && ["sent", "delivered", "read"].includes(outbox.status));
}

export async function applyWhatsAppWebhook(body: unknown) {
  const workshopId = getConfiguredWhatsAppWorkshopId(process.env);
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!workshopId || !phoneNumberId) return;
  const entries = (body as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; statuses?: Array<{ id?: string; status?: string; timestamp?: string }>; messages?: Array<{ from?: string; text?: { body?: string } }> } }> }> })?.entry ?? [];
  for (const entry of entries) for (const change of entry.changes ?? []) {
    if (change.value?.metadata?.phone_number_id !== phoneNumberId) continue;
    for (const status of change.value?.statuses ?? []) {
      if (!status.id || !status.status) continue;
      const mapped = new Set(["sent", "delivered", "read", "failed"]).has(status.status) ? status.status as "sent" | "delivered" | "read" | "failed" : "sent";
      const [outbox] = await getDatabase().update(messageOutbox).set({ status: mapped, updatedAt: new Date() }).where(and(eq(messageOutbox.workshopId, workshopId), eq(messageOutbox.providerMessageId, status.id))).returning();
      if (outbox) await getDatabase().insert(messageDeliveries).values({ workshopId: outbox.workshopId, outboxId: outbox.id, providerMessageId: status.id, status: mapped, occurredAt: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date() });
    }
    for (const message of change.value?.messages ?? []) {
      const text = message.text?.body?.trim().toLocaleUpperCase("pt-BR");
      if (!message.from || !text || !new Set(["SAIR", "STOP", "CANCELAR", "PARAR"]).has(text)) continue;
      const phone = message.from.replace(/\D/g, "");
      const optedOut = await getDatabase().update(customers).set({ whatsappConsent: false, whatsappOptOutAt: new Date(), updatedAt: new Date() }).where(and(eq(customers.workshopId, workshopId), eq(customers.phoneNormalized, phone))).returning({ id: customers.id });
      if (optedOut.length) await getDatabase().update(messageOutbox).set({ status: "cancelled", lastError: "Consentimento revogado.", updatedAt: new Date() }).where(and(eq(messageOutbox.workshopId, workshopId), inArray(messageOutbox.customerId, optedOut.map((customer) => customer.id)), inArray(messageOutbox.status, ["pending", "processing"])));
    }
  }
}
