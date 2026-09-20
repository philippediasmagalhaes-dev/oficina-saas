import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { VehicleForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { getMotorcyclesData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function MotorcyclesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getMotorcyclesData();
  const { q = "" } = await searchParams;
  const query = q.trim().toLocaleLowerCase("pt-BR");
  const motorcycles = query ? data.motorcycles.filter((motorcycle) => `${motorcycle.plate} ${motorcycle.make} ${motorcycle.model} ${motorcycle.customerName}`.toLocaleLowerCase("pt-BR").includes(query)) : data.motorcycles;

  return <AppShell workshopName={data.workshop.name} current="/motos">
    <div className="page-heading"><div><p className="eyebrow">MOTOS</p><h1>Cada moto com sua própria história.</h1><p>Consulte proprietário, quilometragem, serviços anteriores e próximas manutenções.</p></div><a className="primary-button" href="#nova">Cadastrar moto</a></div>
    <section className="surface filter-surface"><form className="motorcycle-search" method="get"><input name="q" defaultValue={q} placeholder="Buscar por placa, modelo ou cliente" /><button className="secondary-button" type="submit">Buscar</button>{q ? <a className="secondary-button" href="/motos">Limpar</a> : null}</form></section>
    <section className="surface"><div className="section-title"><div><span>{motorcycles.length} encontradas</span><h2>Motos da oficina</h2></div></div>{motorcycles.length ? <div className="motorcycle-grid">{motorcycles.map((motorcycle) => <a className="motorcycle-card" href={`/motos/${motorcycle.id}`} key={motorcycle.id}><span>{motorcycle.plate}</span><h3>{motorcycle.make} {motorcycle.model}</h3><p>{motorcycle.customerName}</p><div><small>{motorcycle.year ?? "Ano não informado"}</small><small>{motorcycle.serviceCount} {motorcycle.serviceCount === 1 ? "OS" : "OSs"}</small></div></a>)}</div> : <EmptyState title="Nenhuma moto encontrada" description="Cadastre uma moto ou ajuste a busca." />}</section>
    <section className="surface" id="nova"><div className="section-title"><div><span>Novo cadastro</span><h2>Adicionar moto</h2></div></div>{data.customers.length ? <VehicleForm customers={data.customers} /> : <EmptyState title="Cadastre um cliente primeiro" description="Toda moto precisa ter um proprietário." action="Ir para clientes" href="/clientes" />}</section>
  </AppShell>;
}
