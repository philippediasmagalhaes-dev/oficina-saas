import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

const navigation = [
  ["Visão geral", "/", "⌂"],
  ["Clientes", "/clientes", "◎"],
  ["Serviços", "/servicos", "◫"],
  ["Retenção", "/retencao", "↗"],
  ["Estoque", "/estoque", "▦"],
  ["Configurações", "/configuracoes", "⚙"],
] as const;

export function AppShell({ workshopName, current = "/", children }: { workshopName: string; current?: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="side-panel">
        <Link href="/" className="logo-link"><img src="/logo.jpg" alt="Logo" /><span>OFICINA CRM</span></Link>
        <div className="workshop-chip"><span>Oficina ativa</span><strong>{workshopName}</strong></div>
        <nav aria-label="Navegação principal">
          {navigation.map(([label, href, icon]) => <Link key={href} href={href} className={current === href ? "nav-link active" : "nav-link"}><i>{icon}</i>{label}</Link>)}
        </nav>
        <div className="side-footer"><p>Dados protegidos por oficina</p><SignOutButton /></div>
      </aside>
      <div className="content-column">
        <header className="topbar"><div><small>PAINEL DO PROPRIETÁRIO</small><strong>{workshopName}</strong></div><span className="live-pill"><i />Sincronizado</span></header>
        <main className="page-content">{children}</main>
        <nav className="mobile-nav" aria-label="Navegação móvel">
          {navigation.map(([label, href, icon]) => <Link key={href} href={href} className={current === href ? "active" : ""}><i>{icon}</i><span>{label}</span></Link>)}
        </nav>
      </div>
    </div>
  );
}
