export type CustomerClassification = "upcoming" | "overdue" | "inactive" | "current";

type ForecastInput = {
  nextDueAt: string | Date | null;
  lastServiceAt: string | Date | null;
  inactivityDays: number;
};

const DAY_MS = 86_400_000;

function calendarDay(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida");
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

export function classifyCustomer(input: ForecastInput, now = new Date()): CustomerClassification {
  const today = calendarDay(now);

  if (input.nextDueAt) {
    const due = calendarDay(input.nextDueAt);
    if (due < today) return "overdue";
    if (due <= today + 30) return "upcoming";
    return "current";
  }

  if (input.lastServiceAt && today - calendarDay(input.lastServiceAt) >= input.inactivityDays) {
    return "inactive";
  }

  return "current";
}

export function deriveNextDueAt(completedAt: Date, intervalDays: number | null): Date | null {
  if (intervalDays === null) return null;
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) throw new Error("Intervalo inválido");
  const next = new Date(completedAt);
  next.setUTCDate(next.getUTCDate() + intervalDays);
  return next;
}
