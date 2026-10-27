import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardServiceRevenue } from "./dashboard-service-revenue";

describe("dashboard service revenue card", () => {
  it("shows the monthly ranking with count, revenue and participation", () => {
    const html = renderToStaticMarkup(
      <DashboardServiceRevenue
        periodLabel="outubro de 2026"
        items={[
          { name: "Troca de óleo", serviceCount: 14, revenueCents: 280000, shareBasisPoints: 7000 },
          { name: "Alinhamento", serviceCount: 6, revenueCents: 120000, shareBasisPoints: 3000 },
        ]}
      />,
    );

    expect(html).toContain("Receita por serviço");
    expect(html).toContain("outubro de 2026");
    expect(html).toContain("Troca de óleo");
    expect(html).toContain("14 realizações");
    expect(html).toContain("2.800,00");
    expect(html).toContain("70%");
    expect(html.indexOf("Troca de óleo")).toBeLessThan(html.indexOf("Alinhamento"));
  });

  it("shows a useful empty state when the month has no completed services", () => {
    const html = renderToStaticMarkup(
      <DashboardServiceRevenue periodLabel="novembro de 2026" items={[]} />,
    );

    expect(html).toContain("Nenhum serviço concluído em novembro de 2026");
  });
});
