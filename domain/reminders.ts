import { normalizeBrazilianPhone } from "./outreach";

export type ReminderPurpose = "maintenance_due_7d" | "maintenance_due_today" | "maintenance_overdue_14d";
export type ReminderSource = { workshopId: string; workshopName: string; customerId: string; customerName: string; phone: string | null; whatsappConsent: boolean; whatsappOptOutAt: Date | null; serviceRecordId: string; nextDueAt: Date; lastReminderAt: Date | null };
export type ReminderCandidate = { workshopId: string; customerId: string; serviceRecordId: string; recipientPhone: string; purpose: ReminderPurpose; idempotencyKey: string; scheduledAt: Date; payload: Record<string, unknown> };

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function utcDateFromKey(key: string) { return new Date(`${key}T00:00:00Z`); }
function localHour(date: Date) { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(date)); }

function allowedSchedule(now: Date) {
  const hour = localHour(now);
  if (hour >= 8 && hour < 18) return now;
  let key = dateKey(now);
  if (hour >= 18) { const next = utcDateFromKey(key); next.setUTCDate(next.getUTCDate() + 1); key = next.toISOString().slice(0, 10); }
  return new Date(`${key}T11:00:00Z`);
}

export function buildReminderCandidate(source: ReminderSource, now = new Date()): ReminderCandidate | null {
  const recipientPhone = source.phone ? normalizeBrazilianPhone(source.phone) : null;
  if (!source.whatsappConsent || source.whatsappOptOutAt || !recipientPhone) return null;
  if (source.lastReminderAt && now.getTime() - source.lastReminderAt.getTime() < 5 * 86_400_000) return null;
  const difference = Math.round((utcDateFromKey(dateKey(source.nextDueAt)).getTime() - utcDateFromKey(dateKey(now)).getTime()) / 86_400_000);
  const purpose: ReminderPurpose | undefined = difference === 7 ? "maintenance_due_7d" : difference === 0 ? "maintenance_due_today" : difference === -14 ? "maintenance_overdue_14d" : undefined;
  if (!purpose) return null;
  const dueDate = dateKey(source.nextDueAt);
  return { workshopId: source.workshopId, customerId: source.customerId, serviceRecordId: source.serviceRecordId, recipientPhone, purpose, idempotencyKey: `reminder:${source.serviceRecordId}:${purpose}:${dueDate}`, scheduledAt: allowedSchedule(now), payload: { customerName: source.customerName, workshopName: source.workshopName, dueDate, purpose } };
}
