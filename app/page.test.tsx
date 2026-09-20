import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/app-shell";

describe("application shell", () => {
  it("shows the owner workflow modules on desktop and mobile", () => {
    const html = renderToStaticMarkup(<AppShell workshopName="Natinho Scooters">conteúdo</AppShell>);
    for (const label of ["Visão geral", "Clientes", "Motos", "Ordens de Serviço", "Catálogo", "Financeiro", "Retenção", "Estoque", "Configurações"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-label="Navegação móvel"');
    expect(html).not.toContain("Agenda");
    expect(html).not.toContain("Equipe");
  });
});
