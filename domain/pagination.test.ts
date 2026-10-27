import { describe, expect, it } from "vitest";
import {
  buildPageHref,
  buildPageWindow,
  escapeLikePattern,
  normalizePageRequest,
} from "./pagination";

describe("normalizePageRequest", () => {
  it("falls back to the first 24-row page for invalid values", () => {
    expect(normalizePageRequest({ page: "not-a-page", pageSize: "0" })).toEqual({
      page: 1,
      pageSize: 24,
    });
  });

  it("caps an oversized page size so a request stays bounded", () => {
    expect(normalizePageRequest({ page: "2", pageSize: "500" })).toEqual({
      page: 2,
      pageSize: 100,
    });
  });
});

describe("escapeLikePattern", () => {
  it("treats SQL wildcard characters as literal search text", () => {
    expect(escapeLikePattern("100%_oficina\\teste")).toBe(
      "100\\%\\_oficina\\\\teste",
    );
  });
});

describe("buildPageWindow", () => {
  it("clamps a page beyond the result set to the last page", () => {
    expect(buildPageWindow({ total: 49, page: 99, pageSize: 24 })).toEqual({
      total: 49,
      page: 3,
      pageSize: 24,
      pageCount: 3,
      offset: 48,
      hasPrevious: true,
      hasNext: false,
      previousPage: 2,
      nextPage: null,
    });
  });

  it("keeps empty results on page one without phantom navigation", () => {
    expect(buildPageWindow({ total: 0, page: 4, pageSize: 24 })).toEqual({
      total: 0,
      page: 1,
      pageSize: 24,
      pageCount: 1,
      offset: 0,
      hasPrevious: false,
      hasNext: false,
      previousPage: null,
      nextPage: null,
    });
  });
});

describe("buildPageHref", () => {
  it("preserves a search while changing pages", () => {
    expect(buildPageHref("/clientes", { q: "José & Filhos", page: 3 })).toBe(
      "/clientes?q=Jos%C3%A9+%26+Filhos&page=3",
    );
  });

  it("omits empty searches and the first page", () => {
    expect(buildPageHref("/ordens", { q: "  ", page: 1 })).toBe("/ordens");
  });
});
