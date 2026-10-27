export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previousPage: number | null;
  nextPage: number | null;
};

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function positiveInteger(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePageRequest(
  input: { page?: string | number; pageSize?: string | number },
  defaults: { pageSize?: number; maxPageSize?: number } = {},
) {
  const defaultPageSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = defaults.maxPageSize ?? MAX_PAGE_SIZE;
  return {
    page: positiveInteger(input.page, 1),
    pageSize: Math.min(
      positiveInteger(input.pageSize, defaultPageSize),
      maxPageSize,
    ),
  };
}

export function buildPageWindow(input: {
  total: number;
  page: number;
  pageSize: number;
}) {
  const total = Math.max(0, Math.trunc(input.total));
  const pageSize = positiveInteger(input.pageSize, DEFAULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(positiveInteger(input.page, 1), pageCount);
  return {
    total,
    page,
    pageSize,
    pageCount,
    offset: (page - 1) * pageSize,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
    previousPage: page > 1 ? page - 1 : null,
    nextPage: page < pageCount ? page + 1 : null,
  };
}

export function buildPageHref(
  pathname: string,
  input: { q?: string; page: number; extra?: Record<string, string | null | undefined> },
) {
  const params = new URLSearchParams();
  const query = input.q?.trim();
  if (query) params.set("q", query);
  for (const [key, value] of Object.entries(input.extra ?? {})) {
    if (value) params.set(key, value);
  }
  if (input.page > 1) params.set("page", String(input.page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

