import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { ServiceForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getServiceRecords } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function ServicesPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getServiceRecords();
  return <AppShell workshopName={data.workshop.name} current="/servicos">
    <div className="page-heading"><div><p className="eyebrow">SERVIÇOS</p><h1>Histórico simples, previsão clara.</h1><p>Registre somente o que foi concluído e indique quando o cliente deve voltar.</p></div></div>
    <section className="surface" id="novo"><div className="section-title"><div><span>Novo lançamento</span><h2>Registrar serviço concluído</h2></div></div>{data.customers.length ? <ServiceForm customers={data.customers} vehicles={data.vehicles} inventory={data.inventory} /> : <EmptyState title="Cadastre um cliente primeiro" description="O serviço precisa estar vinculado a um cliente da sua oficina." action="Ir para clientes" href="/clientes" />}</section>
    <section className="surface"><div className="section-title"><div><span>{data.services.length} registros</span><h2>Histórico</h2></div></div>{data.services.length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Concluído em</th><th>Próximo retorno</th><th>Valor</th></tr></thead><tbody>{data.services.map((service) => <tr key={service.id}><td><strong>{service.customerName}</strong><small>{service.vehicleLabel ?? "Sem veículo"}</small></td><td>{service.description}</td><td>{service.completedAt.toLocaleDateString("pt-BR")}</td><td>{service.nextDueAt?.toLocaleDateString("pt-BR") ?? "Não definido"}</td><td>{formatCents(service.amountCents)}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum serviço ainda" description="Quando registrar um serviço, o histórico aparecerá aqui." />}</section>
  </AppShell>;
}
