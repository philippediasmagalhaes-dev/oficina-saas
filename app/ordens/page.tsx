import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { PaginationNav } from "../../components/pagination-nav";
import { WorkOrderForm } from "../../components/work-order-form";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { formatOptionalDate } from "../../domain/dates";
import { normalizePageRequest } from "../../domain/pagination";
import { workOrderStatusLabels } from "../../domain/work-orders";
import { getWorkOrdersData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; nova?: string; veiculo?: string }>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const { q = "", page, nova, veiculo } = await searchParams;
  const showForm = nova === "1" || Boolean(veiculo);
  const data = await getWorkOrdersData({
    query: q,
    ...normalizePageRequest({ page }),
    includeFormOptions: showForm,
    selectedVehicleId: veiculo,
  });
  const orders = data.orders;

  return (
    <AppShell workshopName={data.workshop.name} current="/ordens">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ORDENS DE SERVIÇO</p>
          <h1>Ordens de serviço</h1>
          <p>Acompanhe diagnóstico, aprovação, execução e finalização.</p>
        </div>
        <a className="primary-button" href="/ordens?nova=1#nova">
          Abrir nova OS
        </a>
      </div>
      <section className="order-stage-grid compact-stage-grid">
        <article>
          <span>Em andamento</span>
          <strong>{data.statusCounts.active}</strong>
        </article>
        <article>
          <span>Aguardando aprovação</span>
          <strong>{data.statusCounts.awaitingApproval}</strong>
        </article>
        <article>
          <span>Prontas</span>
          <strong>{data.statusCounts.ready}</strong>
        </article>
        <article>
          <span>Entregues</span>
          <strong>{data.statusCounts.delivered}</strong>
        </article>
      </section>
      <section className="surface filter-surface">
        <form className="vehicle-search" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por OS, cliente, placa ou serviço"
            aria-label="Pesquisar ordem de serviço"
          />
          <button className="secondary-button" type="submit">
            Buscar
          </button>
          {q ? (
            <a className="secondary-button" href="/ordens">
              Limpar
            </a>
          ) : null}
        </form>
      </section>
      <section className="surface compact-list-surface">
        <div className="section-title">
          <div>
            <span>{orders.total} ordens</span>
            <h2>Fluxo da oficina</h2>
          </div>
        </div>
        {orders.items.length ? (
          <div className="work-order-list compact-order-list">
            {orders.items.map((order) => (
              <a href={`/ordens/${order.id}`} key={order.id}>
                <span className={`order-status status-${order.status}`}>
                  {workOrderStatusLabels[order.status]}
                </span>
                <div>
                  <strong>{order.complaint || order.description}</strong>
                  <small>
                    {order.customerName} · {order.vehicleLabel ?? "Sem veículo"}
                  </small>
                </div>
                <div className="order-list-meta">
                  <b>{formatCents(order.amountCents)}</b>
                  <small>Entrada: {formatOptionalDate(order.intakeAt)}</small>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title={q ? "Nenhuma ordem encontrada" : "Nenhuma ordem de serviço"}
            description={
              q
                ? "Revise o termo pesquisado ou limpe a busca."
                : "Abra a primeira OS para iniciar o fluxo da oficina."
            }
            action={q ? undefined : "Abrir OS"}
            href={q ? undefined : "/ordens?nova=1#nova"}
          />
        )}
        <PaginationNav
          pathname="/ordens"
          query={q}
          page={orders.page}
          pageCount={orders.pageCount}
          previousPage={orders.previousPage}
          nextPage={orders.nextPage}
        />
      </section>
      {showForm ? (
        <section className="surface" id="nova">
          <div className="section-title">
            <div>
              <span>Entrada do veículo</span>
              <h2>Nova ordem de serviço</h2>
            </div>
          </div>
          {!data.customers.length ? (
            <EmptyState
              title="Cadastre um cliente primeiro"
              description="A OS precisa de um cliente e um veículo."
              action="Ir para clientes"
              href="/clientes#novo"
            />
          ) : (
            <WorkOrderForm customers={data.customers} vehicles={data.vehicles} initialCustomerId={data.selectedVehicle?.customerId} initialVehicleId={data.selectedVehicle?.id} />
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
