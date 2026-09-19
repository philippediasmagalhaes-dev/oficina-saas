import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("application shell", () => {
  it("keeps the primary navigation available on mobile layouts", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('aria-label="Navegação móvel"');
    expect(html).toContain("Ordens de serviço");
  });
});
