import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/app-shell";

function collectNativeAnchorHrefs(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(collectNativeAnchorHrefs);
  if (!isValidElement<{ children?: ReactNode; href?: string }>(node)) return [];

  const hrefs =
    node.type === "a" && typeof node.props.href === "string"
      ? [node.props.href]
      : [];
  return [...hrefs, ...collectNativeAnchorHrefs(node.props.children)];
}

describe("application shell", () => {
  it("shows the owner workflow modules on desktop and mobile", () => {
    const html = renderToStaticMarkup(<AppShell workshopName="Paulinho Autocar">conteúdo</AppShell>);
    for (const label of ["Visão geral", "Clientes", "Veículos", "Ordens de Serviço", "Catálogo", "Colaboradores", "Financeiro", "Retenção", "Estoque", "Configurações"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-label="Navegação móvel"');
    expect(html).not.toContain("Agenda");
    expect(html).not.toContain("Equipe");
  });

  it("uses full-document navigation for the application menu", () => {
    const tree = AppShell({
      workshopName: "Paulinho Autocar",
      children: "conteúdo",
    });
    const hrefs = collectNativeAnchorHrefs(tree);

    expect(hrefs).toHaveLength(21);
    for (const href of [
      "/",
      "/clientes",
      "/veiculos",
      "/ordens",
      "/servicos",
      "/colaboradores",
      "/financeiro",
      "/retencao",
      "/estoque",
      "/configuracoes",
    ]) {
      expect(hrefs).toContain(href);
    }
  });
});
