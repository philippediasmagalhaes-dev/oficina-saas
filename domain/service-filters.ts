export const financialPeriods = [
  "current_month",
  "previous_month",
  "last_3_months",
  "current_year",
  "all",
] as const;

export type FinancialPeriod = (typeof financialPeriods)[number];

export type FinancialFilters = {
  period: FinancialPeriod;
  query: string;
  from: string;
  to: string;
};

type FilterableService = {
  description: string;
  customerName?: string;
  vehicleLabel?: string | null;
  completedAt: Date;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function validDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateInput(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function periodBounds(period: FinancialPeriod, now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (period === "current_month") {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }
  if (period === "previous_month") {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }
  if (period === "last_3_months") {
    return {
      start: new Date(Date.UTC(year, month - 2, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }
  if (period === "current_year") {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }
  return { start: null, end: null };
}

export function parseFinancialPeriod(value?: string): FinancialPeriod {
  return financialPeriods.includes(value as FinancialPeriod)
    ? (value as FinancialPeriod)
    : "current_month";
}

export function filterFinancialServices<T extends FilterableService>(
  services: T[],
  filters: FinancialFilters,
  now = new Date(),
): T[] {
  const hasCustomDates = validDateInput(filters.from) || validDateInput(filters.to);
  const preset = hasCustomDates
    ? { start: null, end: null }
    : periodBounds(filters.period, now);
  const start = validDateInput(filters.from) ? dateInput(filters.from) : preset.start;
  const end = validDateInput(filters.to)
    ? addUtcDays(dateInput(filters.to), 1)
    : preset.end;
  const query = normalizeSearch(filters.query.trim());

  return services.filter((service) => {
    if (start && service.completedAt < start) return false;
    if (end && service.completedAt >= end) return false;
    if (!query) return true;
    return normalizeSearch(
      [service.customerName, service.description, service.vehicleLabel]
        .filter(Boolean)
        .join(" "),
    ).includes(query);
  });
}

export function describeFinancialPeriod(filters: FinancialFilters) {
  if (validDateInput(filters.from) || validDateInput(filters.to)) {
    const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
    const from = validDateInput(filters.from)
      ? formatter.format(dateInput(filters.from))
      : "o início";
    const to = validDateInput(filters.to)
      ? formatter.format(dateInput(filters.to))
      : "hoje";
    return `${from} até ${to}`;
  }
  return {
    current_month: "Mês atual",
    previous_month: "Mês anterior",
    last_3_months: "Últimos 3 meses",
    current_year: "Ano atual",
    all: "Todo o histórico",
  }[filters.period];
}
