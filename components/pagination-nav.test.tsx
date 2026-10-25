import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaginationNav } from "./pagination-nav";

describe("PaginationNav", () => {
  it("renders bounded previous and next links while preserving search", () => {
    const html = renderToStaticMarkup(
      <PaginationNav
        pathname="/clientes"
        query="José & Filhos"
        page={2}
        pageCount={4}
        previousPage={1}
        nextPage={3}
      />,
    );
    expect(html).toContain('href="/clientes?q=Jos%C3%A9+%26+Filhos"');
    expect(html).toContain('href="/clientes?q=Jos%C3%A9+%26+Filhos&amp;page=3"');
    expect(html).toContain("Página 2 de 4");
  });

  it("does not render navigation for a single page", () => {
    expect(
      renderToStaticMarkup(
        <PaginationNav
          pathname="/ordens"
          query=""
          page={1}
          pageCount={1}
          previousPage={null}
          nextPage={null}
        />,
      ),
    ).toBe("");
  });
});
