import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getFinancialDashboard } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function FinancialPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getFinancialDashboard();
  const maxMonthlyRevenue = Math.max(...data.snapshot.monthlyRevenue.map((month) => month.revenueCents), 1);
  const change = data.snapshot.monthChangePercent;

  return <AppShell workshopName={data.workshop.name} current="/financeiro">
    <div className="page-heading"><div><p className="eyebrow">FINANCEIRO</p><h1>Receita visível, decisões mais seguras.</h1><p>Acompanhe o valor dos serviços concluídos. Neste piloto, os números representam receita registrada — não fluxo de caixa.</p></div><a className="primary-button" href="/servicos#novo">Registrar serviço</a></div>
    <section className="metric-grid finance-metrics">
      <article className="metric-card featured"><span>Receita neste mês</span><strong>{formatCents(data.snapshot.currentMonthRevenueCents)}</strong><small>{change === null ? "sem base no mês anterior" : `${change >= 0 ? "+" : ""}${change}% sobre o mês anterior`}</small></article>
      <article className="metric-card"><span>Receita total</span><strong>{formatCents(data.snapshot.totalRevenueCents)}</strong><small>histórico registrado</small></article>
      <article className="metric-card"><span>Ticket médio</span><strong>{formatCents(data.snapshot.averageTicketCents)}</strong><small>por serviço</small></article>
      <article className="metric-card"><span>Serviços</span><strong>{data.snapshot.serviceCount}</strong><small>lançamentos concluídos</small></article>
    </section>
    <section className="surface"><div className="section-title"><div><span>Últimos 6 meses</span><h2>Evolução da receita</h2></div></div>{data.snapshot.serviceCount ? <div className="revenue-chart">{data.snapshot.monthlyRevenue.map((month) => <div className="revenue-row" key={month.key}><span>{month.label}</span><div className="revenue-track"><i style={{ width: `${Math.max((month.revenueCents / maxMonthlyRevenue) * 100, month.revenueCents ? 4 : 0)}%` }} /></div><strong>{formatCents(month.revenueCents)}</strong><small>{month.serviceCount} serv.</small></div>)}</div> : <EmptyState title="Sem dados financeiros" description="Os valores aparecerão quando você registrar serviços concluídos." action="Registrar serviço" href="/servicos#novo" />}</section>
    <div className="split-grid">
      <section className="surface"><div className="section-title"><div><span>Composição</span><h2>Serviços por receita</h2></div></div>{data.snapshot.topServices.length ? <div className="ranking-list">{data.snapshot.topServices.map((service, index) => <div className="ranking-row" key={service.name}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{service.name}</strong><small>{service.serviceCount} {service.serviceCount === 1 ? "atendimento" : "atendimentos"}</small></div><b>{formatCents(service.revenueCents)}</b></div>)}</div> : <EmptyState title="Nenhum serviço registrado" description="O ranking será calculado automaticamente." />}</section>
      <section className="surface"><div className="section-title"><div><span>Recentes</span><h2>Últimas entradas</h2></div><a href="/servicos">Ver histórico</a></div>{data.services.length ? <div className="finance-list">{data.services.slice(0, 6).map((service) => <div key={service.id}><span><strong>{service.description}</strong><small>{service.customerName} · {service.completedAt.toLocaleDateString("pt-BR")}</small></span><b>{formatCents(service.amountCents)}</b></div>)}</div> : <EmptyState title="Sem entradas" description="Registre um atendimento concluído para começar." />}</section>
    </div>
  </AppShell>;
}
