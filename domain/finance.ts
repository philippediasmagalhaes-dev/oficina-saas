export type FinancialService = {
  description: string;
  amountCents: number;
  completedAt: Date;
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
}

export function buildFinancialSnapshot(services: FinancialService[], now = new Date()) {
  const currentKey = monthKey(now);
  const previousDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousKey = monthKey(previousDate);
  const totalRevenueCents = services.reduce((total, service) => total + service.amountCents, 0);
  const currentMonthRevenueCents = services.filter((service) => monthKey(service.completedAt) === currentKey).reduce((total, service) => total + service.amountCents, 0);
  const previousMonthRevenueCents = services.filter((service) => monthKey(service.completedAt) === previousKey).reduce((total, service) => total + service.amountCents, 0);

  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    const key = monthKey(date);
    const entries = services.filter((service) => monthKey(service.completedAt) === key);
    return {
      key,
      label: monthLabel(date),
      revenueCents: entries.reduce((total, service) => total + service.amountCents, 0),
      serviceCount: entries.length,
    };
  });

  const grouped = new Map<string, { name: string; revenueCents: number; serviceCount: number }>();
  for (const service of services) {
    const entry = grouped.get(service.description) ?? { name: service.description, revenueCents: 0, serviceCount: 0 };
    entry.revenueCents += service.amountCents;
    entry.serviceCount += 1;
    grouped.set(service.description, entry);
  }

  return {
    totalRevenueCents,
    currentMonthRevenueCents,
    previousMonthRevenueCents,
    monthChangePercent: previousMonthRevenueCents > 0
      ? Math.round(((currentMonthRevenueCents - previousMonthRevenueCents) / previousMonthRevenueCents) * 100)
      : null,
    averageTicketCents: services.length ? Math.round(totalRevenueCents / services.length) : 0,
    serviceCount: services.length,
    monthlyRevenue,
    topServices: [...grouped.values()].sort((left, right) => right.revenueCents - left.revenueCents).slice(0, 5),
  };
}
