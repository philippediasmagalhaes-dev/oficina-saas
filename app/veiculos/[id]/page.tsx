import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { VehicleEditForm } from "../../../components/forms";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { formatOptionalDate } from "../../../domain/dates";
import { workOrderStatusLabels } from "../../../domain/work-orders";
import { getVehicleData } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getVehicleData(id);
  if (!data.vehicle) notFound();
  const vehicle = data.vehicle;

  return <AppShell workshopName={data.workshop.name} current="/veiculos">
    <div className="order-heading"><div><a className="back-link" href="/veiculos">← Voltar para veículos</a><p className="eyebrow">FICHA DO VEÍCULO · {vehicle.plate}</p><h1>{vehicle.make} {vehicle.model}</h1><p>{vehicle.customerName}{vehicle.year ? ` · ${vehicle.year}` : ""}{vehicle.odometer ? ` · ${vehicle.odometer.toLocaleString("pt-BR")} km` : ""}</p></div><a className="primary-button" href={`/ordens?veiculo=${vehicle.id}#nova`}>Abrir OS</a></div>
    <div className="split-grid vehicle-detail-grid">
      <section className="surface"><div className="section-title"><div><span>Cadastro</span><h2>Dados do veículo</h2></div></div><VehicleEditForm vehicle={vehicle} customers={data.customers} /></section>
      <section className="surface"><div className="section-title"><div><span>{vehicle.history.length} registros</span><h2>Histórico completo</h2></div></div>{vehicle.history.length ? <div className="timeline-list">{vehicle.history.map((entry) => <a href={`/ordens/${entry.id}`} key={entry.id}><i /><div><strong>{entry.complaint || entry.description}</strong><small>{formatOptionalDate(entry.completedAt ?? entry.intakeAt)} · {workOrderStatusLabels[entry.status]}</small><span>{entry.deliveredOdometer ?? entry.odometer ? `${(entry.deliveredOdometer ?? entry.odometer)!.toLocaleString("pt-BR")} km` : "Km não informado"}{entry.nextDueAt ? ` · Próxima ${entry.nextDueAt.toLocaleDateString("pt-BR")}` : ""}</span></div><b>{formatCents(entry.amountCents)}</b></a>)}</div> : <EmptyState title="Sem histórico" description="Abra a primeira ordem de serviço deste veículo." action="Abrir OS" href={`/ordens?veiculo=${vehicle.id}#nova`} />}</section>
    </div>
  </AppShell>;
}
