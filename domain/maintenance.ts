import { normalizeBrazilianPhone, type WhatsAppDraft } from "./outreach";

export function isOilChange(name: string) {
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/cambio|transmiss|diferencial|hidraul|freio/.test(text)) return false;
  return /troca.*oleo|oleo.*troca/.test(text);
}

function sixMonthsAfter(date: Date) {
  const due = new Date(date);
  due.setUTCDate(1);
  due.setUTCMonth(due.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  due.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return due;
}

export function forecastMaintenance(input: {
  serviceName: string;
  completedAt: Date;
  odometer: number | null;
  previousAt?: Date | null;
  previousOdometer?: number | null;
  intervalDays?: number | null;
  intervalKm?: number | null;
  explicitDueAt?: Date | null;
}) {
  const oil = isOilChange(input.serviceName);
  let dueAt = oil ? sixMonthsAfter(input.completedAt) : new Date(input.completedAt.getTime() + (input.intervalDays ?? 180) * 86400000);
  if (input.intervalDays && input.intervalDays > 0) {
    dueAt = new Date(Math.min(dueAt.getTime(), input.completedAt.getTime() + input.intervalDays * 86400000));
  }
  if (input.explicitDueAt && input.explicitDueAt > input.completedAt) {
    dueAt = oil ? new Date(Math.min(dueAt.getTime(), input.explicitDueAt.getTime())) : new Date(input.explicitDueAt);
  }
  const intervalKm = input.intervalKm ?? (oil ? 5000 : null);
  const validOdometer = input.odometer !== null && input.odometer >= 0;
  const targetOdometer = validOdometer && intervalKm ? input.odometer! + intervalKm : null;
  let source: "standard" | "learned" = "standard";
  let dailyKm: number | null = null;
  if (oil && input.previousAt && input.previousOdometer !== null && input.previousOdometer !== undefined && validOdometer && intervalKm) {
    const days = (input.completedAt.getTime() - input.previousAt.getTime()) / 86400000;
    const delta = input.odometer! - input.previousOdometer;
    if (days >= 7 && delta > 0) {
      dailyKm = delta / days;
      const learnedDays = Math.max(7, Math.ceil(intervalKm / dailyKm));
      const learnedAt = new Date(input.completedAt.getTime() + learnedDays * 86400000);
      if (learnedAt < dueAt) { dueAt = learnedAt; source = "learned"; }
    }
  }
  return { dueAt, targetOdometer, source, dailyKm };
}

export function maintenanceDraft(input: {
  phone: string | null; consent: boolean; customer: string; workshop: string;
  serviceName: string; vehicle: string; lastOdometer: number | null;
  targetOdometer: number | null; dueAt: Date;
}): WhatsAppDraft | null {
  const phone = input.consent && input.phone ? normalizeBrazilianPhone(input.phone) : null;
  if (!phone) return null;
  const lastKm = input.lastOdometer === null ? "" : ` O último atendimento foi aos ${input.lastOdometer.toLocaleString("pt-BR")} km.`;
  const nextKm = input.targetOdometer === null ? "" : ` Se já estiver perto de ${input.targetOdometer.toLocaleString("pt-BR")} km, vale antecipar a avaliação.`;
  const message = `Olá, ${input.customer}! Aqui é da ${input.workshop}. Lembrete de ${input.serviceName} do seu ${input.vehicle}.${lastKm} O retorno previsto é ${input.dueAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.${nextKm} Como está a quilometragem atual? Se já realizou o serviço, avise para atualizarmos. Para não receber lembretes, responda SAIR.`;
  return { message, url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
}

