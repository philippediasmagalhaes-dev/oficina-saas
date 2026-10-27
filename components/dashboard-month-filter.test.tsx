import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardMonthFilter } from "./dashboard-month-filter";

describe("dashboard month filter", () => {
  it("submits a shareable month selection with the selected value", () => {
    const html = renderToStaticMarkup(<DashboardMonthFilter value="2026-09" />);
    expect(html).toContain('method="get"');
    expect(html).toContain('name="mes"');
    expect(html).toContain('value="2026-09"');
    expect(html).toContain("Mês do painel");
    expect(html).toContain("Aplicar");
  });
});
