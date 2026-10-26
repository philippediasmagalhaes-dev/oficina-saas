import { SignOutButton } from "./sign-out-button";
import { NumericFieldBehavior } from "./numeric-field-behavior";

const navigation = [
  ["Visão geral", "/", "⌂"],
  ["Clientes", "/clientes", "◎"],
  ["Veículos", "/veiculos", "◇"],
  ["Ordens de Serviço", "/ordens", "◫"],
  ["Catálogo", "/servicos", "≡"],
  ["Colaboradores", "/colaboradores", "♙"],
  ["Financeiro", "/financeiro", "↟"],
  ["Retenção", "/retencao", "↗"],
  ["Estoque", "/estoque", "▦"],
  ["Configurações", "/configuracoes", "⚙"],
] as const;

export function AppShell({ workshopName, current = "/", children }: { workshopName: string; current?: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <NumericFieldBehavior />
      <aside className="side-panel">
        <a href="/" className="logo-link"><img src="/logo.jpg" alt={`Logo ${workshopName}`} /><span>{workshopName}</span></a>
        <div className="workshop-chip"><span>Oficina ativa</span><strong>{workshopName}</strong></div>
        <nav aria-label="Navegação principal">
          {navigation.map(([label, href, icon]) => <a key={href} href={href} className={current === href ? "nav-link active" : "nav-link"}><i>{icon}</i>{label}</a>)}
        </nav>
        <div className="side-footer"><p>Dados protegidos por oficina</p><SignOutButton /></div>
      </aside>
      <div className="content-column">
        <header className="topbar"><div><small>PAINEL DO PROPRIETÁRIO</small><strong>{workshopName}</strong></div><span className="live-pill"><i />Sincronizado</span></header>
        <main className="page-content">{children}</main>
        <nav className="mobile-nav" aria-label="Navegação móvel">
          {navigation.map(([label, href, icon]) => <a key={href} href={href} className={current === href ? "active" : ""}><i>{icon}</i><span>{label}</span></a>)}
        </nav>
      </div>
    </div>
  );
}
