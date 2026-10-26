import { AppShell } from "../../components/app-shell";
import { FinanceNav } from "../../components/finance-nav";
import { FinancialEntryTable } from "../../components/financial-entry-table";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getFinancialWorkspace } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function FinancialPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getFinancialWorkspace({ pageSize: 12 });
  const open = data.entries.items.filter((entry) => entry.status === "expected" || entry.status === "partial");
  const incomeOpen = open.filter((entry) => entry.direction === "income").reduce((sum, entry) => sum + entry.grossAmountCents, 0);
  const expenseOpen = open.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + entry.grossAmountCents, 0);
  const settledBalance = data.entries.items.filter((entry) => entry.status === "settled").reduce((sum, entry) => sum + (entry.direction === "income" ? entry.netAmountCents : -entry.netAmountCents), 0);
  return <AppShell workshopName={data.workshop.name} current="/financeiro">
    <div className="page-heading"><div><p className="eyebrow">FINANCEIRO</p><h1>Controle financeiro da oficina</h1><p>Recebimentos, pagamentos, caixa e relatórios organizados por rotina.</p></div><a className="primary-button" href="/financeiro/pagar#novo">Novo lançamento</a></div>
    <FinanceNav current="/financeiro" />
    <section className="metric-grid finance-overview-metrics">
      <article className="metric-card featured"><span>Saldo dos últimos lançamentos</span><strong>{formatCents(settledBalance)}</strong><small>entradas menos saídas liquidadas</small></article>
      <article className="metric-card"><span>A receber em aberto</span><strong>{formatCents(incomeOpen)}</strong><small>títulos aguardando baixa</small></article>
      <article className="metric-card"><span>A pagar em aberto</span><strong>{formatCents(expenseOpen)}</strong><small>compromissos pendentes</small></article>
      <article className="metric-card"><span>Caixas ativos</span><strong>{data.cashSessions.filter((session) => !session.closedAt).length}</strong><small>sessões em operação</small></article>
    </section>
    <section className="surface compact-list-surface"><div className="section-title"><div><span>Movimentação</span><h2>Últimos títulos</h2></div><a href="/financeiro/relatorios">Ver relatórios</a></div><FinancialEntryTable entries={data.entries.items} settlements={data.settlements} accounts={data.accounts} /></section>
  </AppShell>;
}
