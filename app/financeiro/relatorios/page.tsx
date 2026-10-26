import { AppShell } from "../../../components/app-shell";
import { FinanceNav } from "../../../components/finance-nav";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { parseFinancialPeriod } from "../../../domain/service-filters";
import { getFinancialDashboard } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

type Params = { period?: string; from?: string; to?: string; recognition?: string };
export default async function FinancialReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const config = readServerConfig(process.env); if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const params = await searchParams;
  const filters = { period: parseFinancialPeriod(params.period), query: "", from: params.from ?? "", to: params.to ?? "", recognitionMode: params.recognition === "accrual" ? "accrual" as const : "cash" as const };
  const data = await getFinancialDashboard(filters);
  const exportQuery = new URLSearchParams({ period: filters.period, recognition: filters.recognitionMode });
  if (filters.from) exportQuery.set("from", filters.from); if (filters.to) exportQuery.set("to", filters.to);
  const maxRevenue = Math.max(...data.snapshot.monthlyRevenue.map((month) => month.revenueCents), 1);
  return <AppShell workshopName={data.workshop.name} current="/financeiro/relatorios">
    <div className="page-heading"><div><p className="eyebrow">RELATÓRIOS</p><h1>Resultado e desempenho</h1><p>Analise por caixa ou competência e exporte os lançamentos.</p></div><a className="secondary-button" href={`/api/financeiro/business-fin?${exportQuery}`}>Exportar Business Fin</a></div><FinanceNav current="/financeiro/relatorios" />
    <section className="surface filter-surface"><form className="finance-operations-filter"><label>Período<select name="period" defaultValue={filters.period}><option value="current_month">Mês atual</option><option value="previous_month">Mês anterior</option><option value="last_3_months">Últimos 3 meses</option><option value="current_year">Ano atual</option><option value="all">Todo histórico</option></select></label><label>De<input name="from" type="date" defaultValue={filters.from} /></label><label>Até<input name="to" type="date" defaultValue={filters.to} /></label><label>Regime<select name="recognition" defaultValue={filters.recognitionMode}><option value="cash">Caixa</option><option value="accrual">Competência</option></select></label><button className="primary-button" type="submit">Atualizar</button></form></section>
    <section className="metric-grid finance-overview-metrics"><article className="metric-card featured"><span>Entradas líquidas</span><strong>{formatCents(data.ledger.incomeCents)}</strong><small>taxas já descontadas</small></article><article className="metric-card"><span>Saídas</span><strong>{formatCents(data.ledger.expenseCents)}</strong></article><article className="metric-card"><span>Impostos separados</span><strong>{formatCents(data.ledger.reserveCents)}</strong></article><article className="metric-card"><span>Resultado gerencial</span><strong>{formatCents(data.ledger.balanceCents)}</strong></article></section>
    <section className="surface"><div className="section-title"><div><span>{data.periodLabel}</span><h2>Evolução mensal</h2></div></div><div className="revenue-chart">{data.snapshot.monthlyRevenue.map((month) => <div className="revenue-row" key={month.key}><span>{month.label}</span><div className="revenue-track"><i style={{ width: `${Math.max((month.revenueCents / maxRevenue) * 100, month.revenueCents ? 4 : 0)}%` }} /></div><strong>{formatCents(month.revenueCents)}</strong><small>{month.serviceCount} serv.</small></div>)}</div></section>
    <div className="split-grid"><section className="surface"><div className="section-title"><div><span>Serviços</span><h2>Receita por serviço</h2></div></div><div className="ranking-list">{data.snapshot.topServices.map((service, index) => <div className="ranking-row" key={service.name}><span>{index + 1}</span><div><strong>{service.name}</strong><small>{service.serviceCount} atendimentos</small></div><b>{formatCents(service.revenueCents)}</b></div>)}</div></section><section className="surface"><div className="section-title"><div><span>Indicadores</span><h2>Atendimento</h2></div></div><div className="settings-list"><div><span>Ticket médio</span><strong>{formatCents(data.snapshot.averageTicketCents)}</strong></div><div><span>Serviços</span><strong>{data.snapshot.serviceCount}</strong></div><div><span>Clientes</span><strong>{data.customerCount}</strong></div></div></section></div>
  </AppShell>;
}
