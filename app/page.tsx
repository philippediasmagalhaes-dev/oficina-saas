import { ConfigurationPending } from "./configurar/page";
import { readServerConfig } from "../db/config";
import { formatCents } from "../domain/money";
import { workOrderStatusLabels, type WorkOrderStatus } from "../domain/work-orders";
import { AppShell } from "../components/app-shell";
import { EmptyState } from "../components/empty-state";
import { getDashboardData } from "../server/queries";
import { parseMonthPeriod } from "../domain/dates";
import { DashboardMonthFilter } from "../components/dashboard-month-filter";

export default async function Home({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { mes } = await searchParams;
  const period = parseMonthPeriod(mes);
  const data = await getDashboardData(period);
  return (
    <AppShell workshopName={data.workshop.name} current="/">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">OPERAÇÃO DE HOJE</p>
          <h1>Visão geral da oficina</h1>
          <p>Prioridades operacionais, ordens em andamento e resultado do mês em uma única tela.</p>
        </div>
        <div className="dashboard-heading-controls">
          <DashboardMonthFilter value={period.value} />
          <div className="dashboard-actions">
            <a className="secondary-button" href="/clientes?novo=1#novo">Novo cliente</a>
            <a className="primary-button" href="/ordens?nova=1#nova">Abrir ordem de serviço</a>
          </div>
        </div>
      </div>

      <section className="metric-grid dashboard-metrics" aria-label="Indicadores principais">
        <article className="metric-card featured"><span>Faturamento · {period.label}</span><strong>{formatCents(data.metrics.revenueCents)}</strong><small>{data.metrics.serviceCount} serviços concluídos</small></article>
        <article className="metric-card"><span>OS em andamento</span><strong>{data.metrics.openOrders}</strong><small>em todas as etapas abertas</small></article>
        <article className="metric-card metric-alert"><span>Recebimentos vencidos</span><strong>{formatCents(data.metrics.overdueReceivablesCents)}</strong><small>exigem acompanhamento</small></article>
        <article className="metric-card"><span>Prontos para entrega</span><strong>{data.metrics.readyOrders}</strong><small>clientes para avisar</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="surface dashboard-priorities">
          <div className="section-title"><div><span>Atenção</span><h2>Prioridades</h2></div></div>
          {data.priorities.length ? <div className="priority-list">
            {data.priorities.map((priority) => <a href={priority.href} className={`priority-row ${priority.tone}`} key={priority.kind}>
              <span className="priority-count">{priority.count}</span>
              <span><strong>{priority.title}</strong><small>{priority.description}</small></span>
              {priority.amountCents !== undefined ? <b>{formatCents(priority.amountCents)}</b> : <b>Abrir</b>}
            </a>)}
          </div> : <p className="dashboard-clear">Nenhuma pendência crítica no momento.</p>}
        </article>

        <article className="surface order-flow-card">
          <div className="section-title"><div><span>Fluxo</span><h2>Ordens de serviço</h2></div><a href="/ordens">Ver quadro</a></div>
          <div className="order-flow">
            <a href="/ordens"><strong>{data.orderCounts.active}</strong><span>Em andamento</span></a>
            <a href="/ordens?status=awaiting_approval"><strong>{data.orderCounts.awaitingApproval}</strong><span>Aguardando aprovação</span></a>
            <a href="/ordens?status=ready"><strong>{data.orderCounts.ready}</strong><span>Prontas</span></a>
            <a href="/ordens?status=delivered"><strong>{data.orderCounts.delivered}</strong><span>Entregues</span></a>
          </div>
        </article>
      </section>

      <section className="surface compact-list-surface">
        <div className="section-title"><div><span>Atualizações recentes</span><h2>Últimas ordens movimentadas</h2></div><a href="/ordens">Todas as OS</a></div>
        {data.recentOrders.length ? <div className="table-wrap"><table>
          <thead><tr><th>OS</th><th>Cliente e veículo</th><th>Etapa</th><th>Valor</th><th></th></tr></thead>
          <tbody>{data.recentOrders.map((order) => <tr key={order.id}>
            <td><strong>#{order.orderNumber ?? "—"}</strong><small>{order.updatedAt.toLocaleDateString("pt-BR")}</small></td>
            <td><strong>{order.customerName}</strong><small>{order.vehicleLabel ?? "Sem veículo"}</small></td>
            <td><span className="status-badge">{workOrderStatusLabels[order.status as WorkOrderStatus]}</span></td>
            <td>{formatCents(order.amountCents)}</td>
            <td><a className="table-link" href={`/ordens/${order.id}`}>Abrir</a></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title="Nenhuma ordem cadastrada" description="Abra a primeira ordem de serviço para iniciar a operação." action="Abrir ordem" href="/ordens?nova=1#nova" />}
      </section>

      <section className="split-grid dashboard-secondary">
        <article className="surface compact-list-surface">
          <div className="section-title"><div><span>Estoque</span><h2>Reposição necessária</h2></div><a href="/estoque">Abrir estoque</a></div>
          {data.lowStockItems.length ? <div className="dashboard-mini-list">{data.lowStockItems.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.sku ?? "Sem código"}</small></span><b>{item.currentQuantity - (item.reservedQuantity ?? 0)} {item.unit}</b></div>)}</div> : <p className="dashboard-clear">Estoque dentro dos mínimos cadastrados.</p>}
        </article>
        <article className="surface compact-list-surface">
          <div className="section-title"><div><span>Relacionamento</span><h2>Próximos retornos</h2></div><a href="/retencao">Abrir retenção</a></div>
          {data.returns.length ? <div className="dashboard-mini-list">{data.returns.map((item) => <div key={item.id}><span><strong>{item.customerName}</strong><small>{item.serviceName} · {item.vehicleLabel}</small></span><b>{item.dueAt.toLocaleDateString("pt-BR")}</b></div>)}</div> : <p className="dashboard-clear">Nenhum retorno previsto nesta faixa.</p>}
        </article>
      </section>
    </AppShell>
  );
}
