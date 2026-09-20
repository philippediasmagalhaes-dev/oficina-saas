import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { WorkOrderForm } from "../../components/work-order-form";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { workOrderStatusLabels } from "../../domain/work-orders";
import { getWorkOrdersData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function WorkOrdersPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getWorkOrdersData();
  const active = data.orders.filter((order) => !["delivered", "completed", "cancelled"].includes(order.status));

  return <AppShell workshopName={data.workshop.name} current="/ordens">
    <div className="page-heading"><div><p className="eyebrow">ORDENS DE SERVIÇO</p><h1>Da entrada à entrega, sem perder o contexto.</h1><p>Acompanhe diagnóstico, aprovação, execução e finalização de cada moto.</p></div><a className="primary-button" href="#nova">Abrir nova OS</a></div>
    <section className="order-stage-grid"><article><span>Em andamento</span><strong>{active.length}</strong></article><article><span>Aguardando aprovação</span><strong>{data.orders.filter((order) => order.status === "awaiting_approval").length}</strong></article><article><span>Prontas</span><strong>{data.orders.filter((order) => order.status === "ready").length}</strong></article><article><span>Entregues</span><strong>{data.orders.filter((order) => ["delivered", "completed"].includes(order.status)).length}</strong></article></section>
    <section className="surface"><div className="section-title"><div><span>{data.orders.length} ordens</span><h2>Fluxo da oficina</h2></div></div>{data.orders.length ? <div className="work-order-list">{data.orders.map((order) => <a href={`/ordens/${order.id}`} key={order.id}><span className={`order-status status-${order.status}`}>{workOrderStatusLabels[order.status]}</span><div><strong>{order.complaint || order.description}</strong><small>{order.customerName} · {order.vehicleLabel ?? "Sem moto"}</small></div><div className="order-list-meta"><b>{formatCents(order.amountCents)}</b><small>{order.updatedAt.toLocaleDateString("pt-BR")}</small></div></a>)}</div> : <EmptyState title="Nenhuma ordem de serviço" description="Abra a primeira OS para iniciar o fluxo da oficina." action="Abrir OS" href="#nova" />}</section>
    <section className="surface" id="nova"><div className="section-title"><div><span>Entrada da moto</span><h2>Nova ordem de serviço</h2></div></div>{!data.customers.length ? <EmptyState title="Cadastre um cliente primeiro" description="A OS precisa de um cliente e uma moto." action="Ir para clientes" href="/clientes" /> : !data.vehicles.length ? <EmptyState title="Cadastre uma moto primeiro" description="A OS precisa estar ligada ao histórico de uma moto." action="Ir para motos" href="/motos#nova" /> : <WorkOrderForm customers={data.customers} vehicles={data.vehicles} />}</section>
  </AppShell>;
}
