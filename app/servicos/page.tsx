import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { ServiceCatalogForm } from "../../components/forms";
import { ServiceForm } from "../../components/service-form";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getServiceRecords } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function ServicesPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getServiceRecords();
  return <AppShell workshopName={data.workshop.name} current="/servicos">
    <div className="page-heading"><div><p className="eyebrow">SERVIÇOS</p><h1>Catálogo organizado, histórico claro.</h1><p>Cadastre os serviços oferecidos uma vez e associe cada atendimento ao cliente certo.</p></div></div>
    <div className="split-grid">
      <section className="surface" id="catalogo"><div className="section-title"><div><span>Catálogo</span><h2>Cadastrar serviço</h2></div></div><ServiceCatalogForm /></section>
      <section className="surface"><div className="section-title"><div><span>{data.catalog.length} cadastrados</span><h2>Serviços oferecidos</h2></div></div>{data.catalog.length ? <div className="catalog-list">{data.catalog.map((item) => <div className="catalog-row" key={item.id}><div><strong>{item.name}</strong><small>{item.defaultReturnIntervalDays ? `Retorno sugerido em ${item.defaultReturnIntervalDays} dias` : "Sem retorno definido"}</small></div><b>{formatCents(item.defaultPriceCents)}</b></div>)}</div> : <EmptyState title="Catálogo vazio" description="Cadastre o primeiro serviço para usá-lo nos atendimentos." />}</section>
    </div>
    <section className="surface" id="novo"><div className="section-title"><div><span>Novo lançamento</span><h2>Registrar serviço concluído</h2></div></div>{!data.customers.length ? <EmptyState title="Cadastre um cliente primeiro" description="O serviço precisa estar vinculado a um cliente da sua oficina." action="Ir para clientes" href="/clientes" /> : !data.catalog.length ? <EmptyState title="Cadastre um serviço primeiro" description="Use o catálogo acima para padronizar os atendimentos." action="Cadastrar serviço" href="#catalogo" /> : <ServiceForm customers={data.customers} vehicles={data.vehicles} catalog={data.catalog} inventory={data.inventory} />}</section>
    <section className="surface"><div className="section-title"><div><span>{data.services.length} registros</span><h2>Histórico</h2></div></div>{data.services.length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Concluído em</th><th>Próximo retorno</th><th>Valor</th></tr></thead><tbody>{data.services.map((service) => <tr key={service.id}><td><strong>{service.customerName}</strong><small>{service.vehicleLabel ?? "Sem veículo"}</small></td><td>{service.description}</td><td>{service.completedAt.toLocaleDateString("pt-BR")}</td><td>{service.nextDueAt?.toLocaleDateString("pt-BR") ?? "Não definido"}</td><td>{formatCents(service.amountCents)}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum serviço ainda" description="Quando registrar um serviço, o histórico aparecerá aqui." />}</section>
  </AppShell>;
}
