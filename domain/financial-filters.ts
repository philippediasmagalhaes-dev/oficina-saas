export type FinancialDirectionFilter = "income" | "expense" | "reserve";
export type FinancialStatusFilter = "expected" | "partial" | "settled" | "cancelled";
export type FinancialDueFilter = "overdue" | "today" | "next_7_days" | "next_30_days";

export type RawFinancialFilters = {
  page?: string | number | null;
  pageSize?: string | number | null;
  direction?: string | null;
  status?: string | null;
  due?: string | null;
  search?: string | null;
  category?: string | null;
};

const directions = new Set<FinancialDirectionFilter>(["income", "expense", "reserve"]);
const statuses = new Set<FinancialStatusFilter>(["expected", "partial", "settled", "cancelled"]);
const dueFilters = new Set<FinancialDueFilter>(["overdue", "today", "next_7_days", "next_30_days"]);

function positiveInteger(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function normalizeFinancialFilters(input: RawFinancialFilters, now = new Date()) {
  const page = positiveInteger(input.page, 1);
  const pageSize = Math.min(positiveInteger(input.pageSize, 25), 100);
  const direction = directions.has(input.direction as FinancialDirectionFilter)
    ? (input.direction as FinancialDirectionFilter)
    : undefined;
  const status = statuses.has(input.status as FinancialStatusFilter)
    ? (input.status as FinancialStatusFilter)
    : undefined;
  const due = dueFilters.has(input.due as FinancialDueFilter)
    ? (input.due as FinancialDueFilter)
    : undefined;
  const today = startOfUtcDay(now);
  let dueFrom: Date | undefined;
  let dueTo: Date | undefined;
  if (due === "overdue") dueTo = today;
  if (due === "today") {
    dueFrom = today;
    dueTo = addUtcDays(today, 1);
  }
  if (due === "next_7_days") {
    dueFrom = today;
    dueTo = addUtcDays(today, 7);
  }
  if (due === "next_30_days") {
    dueFrom = today;
    dueTo = addUtcDays(today, 30);
  }
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    direction,
    status,
    due,
    dueFrom,
    dueTo,
    search: input.search?.trim() || undefined,
    category: input.category?.trim() || undefined,
  };
}
