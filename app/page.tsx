"use client";

import { useState } from "react";

const jobs = [
  ["#1048", "Toyota Corolla", "Revisão 40 mil km", "Hoje, 14:30", "Em execução", "amber"],
  ["#1047", "Honda Civic", "Alinhamento e balanceamento", "Hoje, 15:15", "Aguardando", "blue"],
  ["#1043", "Jeep Renegade", "Troca de óleo", "Hoje, 16:00", "Confirmado", "green"],
];

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = { grid: "▦", wrench: "⌁", calendar: "◷", users: "♧", chart: "⌁", settings: "⚙", bell: "•", plus: "+", arrow: "→", search: "⌕", bolt: "✦" };
  return <span aria-hidden="true">{icons[name]}</span>;
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Visão geral");
  const [toast, setToast] = useState(false);
  const nav = [["grid", "Visão geral"], ["wrench", "Ordens de serviço"], ["calendar", "Agenda"], ["users", "Clientes"], ["chart", "Relatórios"]];

  function newOrder() { setToast(true); window.setTimeout(() => setToast(false), 2600); }
  return (
    <main className={dark ? "app dark" : "app"}>
      <aside className="sidebar">
        <a className="brand" href="#top"><i>o</i><span>oficina</span></a>
        <div className="workspace"><span className="avatar">OT</span><span><b>Oficina Torres</b><small>Plano Pro</small></span><button aria-label="Trocar oficina">⌄</button></div>
        <nav>{nav.map(([icon, label]) => <button key={label} onClick={() => setActive(label)} className={active === label ? "selected" : ""}><Icon name={icon} /><span>{label}</span>{label === "Ordens de serviço" && <em>12</em>}</button>)}</nav>
        <div className="sidebar-bottom"><button><Icon name="settings" />Configurações</button><div className="help"><span>?</span><p><b>Precisa de ajuda?</b><small>Fale com nosso time</small></p></div></div>
      </aside>
      <section className="shell" id="top">
        <header>
          <div className="crumb"><span>Oficina Torres</span><b>/</b><strong>{active}</strong></div>
          <div className="actions"><button className="theme" onClick={() => setDark(!dark)} aria-label="Alternar tema">{dark ? "☀" : "◐"}</button><button className="notification" aria-label="Notificações"><Icon name="bell" /><i /></button><button className="profile">MC</button></div>
        </header>
        <div className="content">
          <section className="intro"><div><p className="eyebrow">SEXTA-FEIRA, 18 DE SETEMBRO</p><h1>Bom dia, Marcelo <span>✦</span></h1><p className="sub">Sua operação está fluindo bem hoje.</p></div><button className="primary" onClick={newOrder}><Icon name="plus" />Nova ordem</button></section>
          <section className="metrics">
            <article><div className="metric-top"><span>Faturamento do mês</span><b className="up">↗ 12,5%</b></div><h2>R$ 48.240<span>,00</span></h2><div className="spark"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><p>vs. R$ 42.870 no mês anterior</p></article>
            <article><div className="metric-top"><span>Ordens em aberto</span><b className="soft">12</b></div><h2>12 <span>serviços</span></h2><div className="progress"><i /></div><p>8 em execução · 4 aguardando</p></article>
            <article><div className="metric-top"><span>Ticket médio</span><b className="up">↗ 8,2%</b></div><h2>R$ 386<span>,00</span></h2><div className="bars"><i /><i /><i /><i /><i /><i /><i /></div><p>vs. R$ 357 no mês anterior</p></article>
          </section>
          <section className="board">
            <div className="section-head"><div><h2>Prioridades de hoje</h2><p>Acompanhe o que precisa da sua atenção.</p></div><button>Ver agenda completa <Icon name="arrow" /></button></div>
            <div className="jobs">{jobs.map(([id, car, work, time, status, color]) => <article className="job" key={id}><div className="job-icon">⌁</div><div className="job-main"><div><span className="job-id">{id}</span><b>{car}</b></div><p>{work}</p></div><div className="job-time"><b>{time}</b><p><i className={color} />{status}</p></div><button className="more" aria-label={`Mais opções para ${id}`}>•••</button></article>)}</div>
          </section>
          <section className="lower"><article className="activity"><div className="section-head"><div><h2>Atividade recente</h2><p>O que aconteceu na sua operação.</p></div><button>Ver tudo</button></div><div className="timeline"><p><i className="mint" /><span><b>Pagamento recebido</b><small>OS #1042 · R$ 680,00</small></span><time>há 18 min</time></p><p><i className="violet" /><span><b>Nova ordem criada</b><small>OS #1048 · Toyota Corolla</small></span><time>há 42 min</time></p><p><i className="blue" /><span><b>Cliente confirmado</b><small>Mariana Souza · 15:15</small></span><time>há 1h</time></p></div></article><article className="goal"><p className="eyebrow">META DO MÊS</p><h2>Quase lá.</h2><p>Você já atingiu <b>80%</b> da sua meta mensal.</p><div className="goal-progress"><i /></div><div><span>R$ 48.240</span><span>R$ 60.000</span></div><button>Ver desempenho <Icon name="arrow" /></button></article></section>
        </div>
      </section>
      {toast && <div className="toast"><span>✓</span><div><b>Nova ordem iniciada</b><p>O formulário está pronto para você.</p></div></div>}
    </main>
  );
}
