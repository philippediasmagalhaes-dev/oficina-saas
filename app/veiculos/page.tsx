import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { VehicleForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { getVehiclesData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getVehiclesData();
  const { q = "" } = await searchParams;
  const query = q.trim().toLocaleLowerCase("pt-BR");
  const vehicles = query ? data.vehicles.filter((vehicle) => `${vehicle.plate} ${vehicle.make} ${vehicle.model} ${vehicle.customerName}`.toLocaleLowerCase("pt-BR").includes(query)) : data.vehicles;

  return <AppShell workshopName={data.workshop.name} current="/veiculos">
    <div className="page-heading"><div><p className="eyebrow">VEÍCULOS</p><h1>Cada veículo com sua própria história.</h1><p>Consulte proprietário, quilometragem, serviços anteriores e próximas manutenções.</p></div><a className="primary-button" href="#novo">Cadastrar veículo</a></div>
    <section className="surface filter-surface"><form className="vehicle-search" method="get"><input name="q" defaultValue={q} placeholder="Buscar por placa, modelo ou cliente" /><button className="secondary-button" type="submit">Buscar</button>{q ? <a className="secondary-button" href="/veiculos">Limpar</a> : null}</form></section>
    <section className="surface"><div className="section-title"><div><span>{vehicles.length} encontrados</span><h2>Veículos da oficina</h2></div></div>{vehicles.length ? <div className="vehicle-grid">{vehicles.map((vehicle) => <a className="vehicle-card" href={`/veiculos/${vehicle.id}`} key={vehicle.id}><span>{vehicle.plate}</span><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.customerName}</p><div><small>{vehicle.year ?? "Ano não informado"}</small><small>{vehicle.serviceCount} {vehicle.serviceCount === 1 ? "OS" : "OSs"}</small></div></a>)}</div> : <EmptyState title="Nenhum veículo encontrado" description="Cadastre um veículo ou ajuste a busca." />}</section>
    <section className="surface" id="novo"><div className="section-title"><div><span>Novo cadastro</span><h2>Adicionar veículo</h2></div></div>{data.customers.length ? <VehicleForm customers={data.customers} /> : <EmptyState title="Cadastre um cliente primeiro" description="Todo veículo precisa ter um proprietário." action="Ir para clientes" href="/clientes" />}</section>
  </AppShell>;
}
