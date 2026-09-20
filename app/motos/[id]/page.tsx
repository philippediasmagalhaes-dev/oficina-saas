import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { MotorcycleEditForm } from "../../../components/forms";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { workOrderStatusLabels } from "../../../domain/work-orders";
import { getMotorcycleData } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

export default async function MotorcyclePage({ params }: { params: Promise<{ id: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getMotorcycleData(id);
  if (!data.motorcycle) notFound();
  const motorcycle = data.motorcycle;

  return <AppShell workshopName={data.workshop.name} current="/motos">
    <div className="order-heading"><div><a className="back-link" href="/motos">← Voltar para motos</a><p className="eyebrow">FICHA DA MOTO · {motorcycle.plate}</p><h1>{motorcycle.make} {motorcycle.model}</h1><p>{motorcycle.customerName}{motorcycle.year ? ` · ${motorcycle.year}` : ""}{motorcycle.odometer ? ` · ${motorcycle.odometer.toLocaleString("pt-BR")} km` : ""}</p></div><a className="primary-button" href={`/ordens?moto=${motorcycle.id}#nova`}>Abrir OS</a></div>
    <div className="split-grid motorcycle-detail-grid">
      <section className="surface"><div className="section-title"><div><span>Cadastro</span><h2>Dados da moto</h2></div></div><MotorcycleEditForm motorcycle={motorcycle} customers={data.customers} /></section>
      <section className="surface"><div className="section-title"><div><span>{motorcycle.history.length} registros</span><h2>Histórico completo</h2></div></div>{motorcycle.history.length ? <div className="timeline-list">{motorcycle.history.map((entry) => <a href={`/ordens/${entry.id}`} key={entry.id}><i /><div><strong>{entry.complaint || entry.description}</strong><small>{entry.completedAt?.toLocaleDateString("pt-BR") ?? entry.createdAt.toLocaleDateString("pt-BR")} · {workOrderStatusLabels[entry.status]}</small><span>{entry.deliveredOdometer ?? entry.odometer ? `${(entry.deliveredOdometer ?? entry.odometer)!.toLocaleString("pt-BR")} km` : "Km não informado"}{entry.nextDueAt ? ` · Próxima ${entry.nextDueAt.toLocaleDateString("pt-BR")}` : ""}</span></div><b>{formatCents(entry.amountCents)}</b></a>)}</div> : <EmptyState title="Sem histórico" description="Abra a primeira ordem de serviço desta moto." action="Abrir OS" href={`/ordens?moto=${motorcycle.id}#nova`} />}</section>
    </div>
  </AppShell>;
}
