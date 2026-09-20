import { AppShell } from "../../components/app-shell";
import { CustomerForm, VehicleForm } from "../../components/forms";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { ConfigurationPending } from "../configurar/page";
import { getCustomers } from "../../server/queries";

export default async function CustomersPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getCustomers();
  return <AppShell workshopName={data.workshop.name} current="/clientes">
    <div className="page-heading"><div><p className="eyebrow">CLIENTES</p><h1>Uma base que trabalha por você.</h1><p>Cadastre contatos, consentimento e os veículos atendidos.</p></div></div>
    <div className="split-grid">
      <section className="surface"><div className="section-title"><div><span>Novo cadastro</span><h2>Cliente</h2></div></div><CustomerForm /></section>
      <section className="surface"><div className="section-title"><div><span>Vínculo</span><h2>Veículo</h2></div></div>{data.customers.length ? <VehicleForm customers={data.customers} /> : <p className="muted">Cadastre um cliente antes de adicionar o veículo.</p>}</section>
    </div>
    <section className="surface"><div className="section-title"><div><span>{data.customers.length} cadastrados</span><h2>Clientes da oficina</h2></div></div>
      {data.customers.length ? <div className="card-list">{data.customers.map((customer) => <article className="list-card" key={customer.id}><div className="avatar">{customer.name.slice(0, 2).toUpperCase()}</div><div><strong>{customer.name}</strong><p>{customer.phone || customer.email || "Sem contato informado"}</p></div><div className="list-actions"><div className="list-meta"><span>{customer.vehicleCount ?? 0} veículo(s)</span><small>{customer.whatsappConsent ? "WhatsApp autorizado" : "Sem autorização WhatsApp"}</small></div><a className="table-link" href={`/clientes/${customer.id}/editar`}>Editar</a></div></article>)}</div> : <EmptyState title="Sua base começa aqui" description="Cadastre o primeiro cliente atendido pela oficina." />}
    </section>
  </AppShell>;
}
