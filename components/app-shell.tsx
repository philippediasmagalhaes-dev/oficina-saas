import { SignOutButton } from "./sign-out-button";
import { NumericFieldBehavior } from "./numeric-field-behavior";
import { ApprovalNotifications } from "./approval-notifications";
import { MobileMoreMenu } from "./mobile-more-menu";

export type NavigationItem = { label: string; shortLabel?: string; href: string; icon: string };

const navigationGroups: Array<{ key: string; label: string; items: NavigationItem[] }> = [
  { key: "operation", label: "Operação", items: [
    { label: "Visão geral", shortLabel: "Início", href: "/", icon: "⌂" },
    { label: "Ordens de Serviço", shortLabel: "OS", href: "/ordens", icon: "▣" },
    { label: "Clientes", href: "/clientes", icon: "◎" },
    { label: "Veículos", href: "/veiculos", icon: "◇" },
    { label: "Catálogo de serviços", href: "/servicos", icon: "≡" },
  ] },
  { key: "relationship", label: "Relacionamento", items: [
    { label: "Retenção", href: "/retencao", icon: "↗" },
    { label: "Notificações", href: "/notificacoes", icon: "◉" },
  ] },
  { key: "management", label: "Gestão", items: [
    { label: "Financeiro", href: "/financeiro", icon: "▤" },
    { label: "Estoque", href: "/estoque", icon: "▦" },
    { label: "Colaboradores", href: "/colaboradores", icon: "♙" },
    { label: "Configurações", href: "/configuracoes", icon: "⚙" },
  ] },
];

const allNavigation = navigationGroups.flatMap((group) => group.items);
const mobilePrimaryHrefs = new Set(["/", "/ordens", "/clientes", "/financeiro"]);

export function isNavigationActive(current: string, href: string) {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

export function AppShell({ workshopName, current = "/", children }: { workshopName: string; current?: string; children: React.ReactNode }) {
  const mobilePrimary = allNavigation.filter((item) => mobilePrimaryHrefs.has(item.href));
  const mobileSecondary = allNavigation.filter((item) => !mobilePrimaryHrefs.has(item.href));
  return (
    <div className="shell">
      <NumericFieldBehavior />
      <ApprovalNotifications workshopName={workshopName} />
      <aside className="side-panel">
        <a href="/" className="logo-link"><img src="/logo.jpg" alt={`Logo ${workshopName}`} /><span>{workshopName}</span></a>
        <div className="workshop-chip"><span>Oficina ativa</span><strong>{workshopName}</strong></div>
        <nav aria-label="Navegação principal" className="desktop-navigation">
          {navigationGroups.map((group) => <section className="navigation-group" data-navigation-group={group.key} key={group.key}>
            <p>{group.label}</p>
            {group.items.map((item) => <a key={item.href} href={item.href} className={isNavigationActive(current, item.href) ? "nav-link active" : "nav-link"}><i aria-hidden="true">{item.icon}</i>{item.label}</a>)}
          </section>)}
        </nav>
        <div className="side-footer"><p>Ambiente seguro · dados da oficina</p><SignOutButton /></div>
      </aside>
      <div className="content-column">
        <header className="topbar"><div><small>PAINEL DA OFICINA</small><strong>{workshopName}</strong></div><span className="live-pill"><i />Operação online</span></header>
        <main className="page-content">{children}</main>
        <nav className="mobile-nav" aria-label="Navegação móvel" data-mobile-primary="true">
          {mobilePrimary.map((item) => <a data-mobile-destination="true" key={item.href} href={item.href} className={isNavigationActive(current, item.href) ? "active" : ""}><i aria-hidden="true">{item.icon}</i><span>{item.shortLabel ?? item.label}</span></a>)}
          <MobileMoreMenu items={mobileSecondary} current={current} />
        </nav>
      </div>
    </div>
  );
}
