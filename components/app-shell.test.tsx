import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("professional application shell", () => {
  it("groups the desktop navigation around the workshop workflow", () => {
    const html = renderToStaticMarkup(<AppShell workshopName="Paulinho Autocar">conteúdo</AppShell>);
    for (const group of ["Operação", "Relacionamento", "Gestão"]) expect(html).toContain(group);
    expect(html).toContain('data-navigation-group="operation"');
    expect(html).toContain('data-navigation-group="relationship"');
    expect(html).toContain('data-navigation-group="management"');
  });

  it("keeps four primary mobile destinations and one compact more menu", () => {
    const html = renderToStaticMarkup(<AppShell workshopName="Paulinho Autocar">conteúdo</AppShell>);
    expect(html).toContain('aria-label="Navegação móvel"');
    expect(html).toContain('data-mobile-primary="true"');
    expect((html.match(/data-mobile-destination="true"/g) ?? [])).toHaveLength(4);
    expect(html).toContain("Mais");
    expect(html).toContain('aria-label="Mais áreas"');
  });

  it("marks nested routes as active", () => {
    const html = renderToStaticMarkup(<AppShell workshopName="Paulinho Autocar" current="/financeiro/contas-a-pagar">conteúdo</AppShell>);
    expect(html).toContain('href="/financeiro" class="nav-link active"');
  });
});
