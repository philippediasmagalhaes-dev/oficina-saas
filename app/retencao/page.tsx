import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { PaginationNav } from "../../components/pagination-nav";
import { WhatsAppLink } from "../../components/whatsapp-link";
import { readServerConfig } from "../../db/config";
import { maintenanceDraft } from "../../domain/maintenance";
import { getRetentionOpportunities } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";
import { confirmBaseWhatsAppConsentAction } from "../actions";

export default async function RetentionPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { page } = await searchParams;
  const data = await getRetentionOpportunities(page);
  const now = new Date();
  return <AppShell workshopName={data.workshop.name} current="/retencao">
    <div className="page-heading"><div><p className="eyebrow">RETENÇÃO</p><h1>Retenção de clientes</h1><p>Retornos por veículo e serviço. A troca de óleo considera seis meses ou a previsão de quilometragem, o que chegar primeiro.</p></div></div>
    <section className="surface"><div className="section-title"><div><span>{data.returns.total} retornos acompanhados</span><h2>Próximas manutenções</h2></div><span>{data.automation.configured ? "WhatsApp automático configurado" : "WhatsApp assistido"}</span></div>
      {data.returns.items.length ? <div className="opportunity-grid">{data.returns.items.map((item) => {
        const overdue = item.dueAt < now;
        const draft = maintenanceDraft({ phone: item.phone, consent: item.consent, customer: item.customerName, workshop: data.workshop.name, serviceName: item.serviceName, vehicle: item.vehicleLabel, lastOdometer: item.odometer, targetOdometer: item.targetOdometer, dueAt: item.dueAt });
        return <article className="opportunity-card" key={item.id}>
          <div><span className={`status ${overdue ? "overdue" : "upcoming"}`}>{overdue ? "Retorno atrasado" : "Retorno previsto"}</span><h3>{item.customerName}</h3><strong>{item.serviceName}</strong><p>{item.vehicleLabel}</p>
            <small>Último: {item.completedAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}{item.odometer !== null ? ` · ${item.odometer.toLocaleString("pt-BR")} km` : ""}</small>
            <p>Retorno: {item.dueAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}{item.targetOdometer ? ` ou ${item.targetOdometer.toLocaleString("pt-BR")} km` : ""}</p>
            <small>{item.source === "learned" ? "Antecipado pelo histórico de uso deste veículo." : "Prazo sugerido pelo serviço."} Quilometragem atual a confirmar com o cliente.</small>
          </div>
          {draft ? <WhatsAppLink href={draft.url}>Abrir WhatsApp</WhatsAppLink> : <a className="table-link" href={`/clientes/${item.customerId}/editar`}>Revisar telefone e autorização</a>}
        </article>;
      })}</div> : <EmptyState title="Nenhum histórico de manutenção" description="Os retornos aparecem após a conclusão de serviços." />}
      <PaginationNav pathname="/retencao" query="" {...data.returns} />
    </section>
    <section className="surface"><details><summary>Registrar autorização prévia da base de clientes</summary><p className="field-hint">Use quando os clientes já autorizaram a oficina a entrar em contato. A data e sua declaração ficam registradas. Clientes que pediram para sair continuam sem autorização.</p><form action={confirmBaseWhatsAppConsentAction}><label className="check-row"><input type="checkbox" name="confirmed" required /> Confirmo que a oficina já possui autorização prévia dos clientes desta base.</label><button className="secondary-button" type="submit">Registrar consentimento da base</button></form></details></section>
  </AppShell>;
}
