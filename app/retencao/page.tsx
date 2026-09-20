import { recordContactAction } from "../actions";
import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { buildWhatsAppDraft } from "../../domain/outreach";
import { getRetentionOpportunities } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

const labels = { upcoming: ["Retorno próximo", "O retorno previsto está nos próximos 30 dias."], overdue: ["Retorno atrasado", "A data prevista já passou."], inactive: ["Cliente inativo", "Não há retorno futuro e o último serviço passou do limite."] } as const;

export default async function RetentionPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getRetentionOpportunities();
  return <AppShell workshopName={data.workshop.name} current="/retencao">
    <div className="page-heading"><div><p className="eyebrow">RETENÇÃO</p><h1>Volte a falar com quem já confia em você.</h1><p>O sistema prioriza retornos previstos, atrasados e clientes inativos.</p></div></div>
    <section className="surface"><div className="section-title"><div><span>{data.opportunities.length} oportunidades</span><h2>Campanha assistida</h2></div></div>{data.opportunities.length ? <div className="opportunity-grid">{data.opportunities.map((customer) => {
      const [title, description] = labels[customer.classification as keyof typeof labels];
      const draft = buildWhatsAppDraft({ phone: customer.phone ?? null, consent: customer.whatsappConsent ?? false, customer: customer.name, workshop: data.workshop.name, reason: title.toLowerCase() });
      return <article className="opportunity-card" key={customer.id}><div><span className={`status ${customer.classification}`}>{title}</span><h3>{customer.name}</h3><p>{description}</p><small>{customer.lastServiceAt ? `Último serviço: ${customer.lastServiceAt.toLocaleDateString("pt-BR")}` : "Sem serviço registrado"}</small></div>{draft ? <form action={recordContactAction}><input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="reason" value={title} /><button className="primary-button" type="submit">Abrir WhatsApp</button></form> : <span className="disabled-note">Adicione telefone e consentimento no cadastro</span>}</article>;
    })}</div> : <EmptyState title="Nenhuma campanha necessária" description="Quando um retorno se aproximar ou um cliente ficar inativo, ele aparecerá aqui." />}</section>
  </AppShell>;
}
