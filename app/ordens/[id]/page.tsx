import { notFound } from "next/navigation";
import {
  notifyServiceReadyAction,
  publishQuoteAction,
  recordOfflineQuoteDecisionAction,
  removeQuoteItemAction,
  reopenApprovedQuoteAction,
  saveDiagnosisAction,
  shareQuoteWhatsAppAction,
  updateWorkOrderStatusAction,
  uploadServicePhotoAction,
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { EmptyState } from "../../../components/empty-state";
import { FinalizationForm } from "../../../components/finalization-form";
import { QuoteItemForm } from "../../../components/quote-item-form";
import { IntakeInspectionForm } from "../../../components/intake-inspection-form";
import { AssignmentForm } from "../../../components/assignment-form";
import { WhatsAppLink } from "../../../components/whatsapp-link";
import { ReadyWhatsAppAction } from "../../../components/ready-whatsapp-action";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { formatOptionalDate } from "../../../domain/dates";
import { buildWorkOrderDraft } from "../../../domain/outreach";
import { workOrderStatusLabels } from "../../../domain/work-orders";
import { formatWorkOrderNumber } from "../../../domain/workshop-settings";
import { getWorkOrderData } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

function statusAction(id: string, status: "diagnosis" | "in_progress" | "ready" | "cancelled", label: string, secondary = false) {
  return <form action={updateWorkOrderStatusAction}><input type="hidden" name="serviceRecordId" value={id} /><input type="hidden" name="status" value={status} /><button className={secondary ? "secondary-button" : "primary-button"} type="submit">{label}</button></form>;
}

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getWorkOrderData(id);
  if (!data.order) notFound();
  const order = data.order;
  const editableQuote = order.status === "diagnosis";
  const finalStatus = ["delivered", "completed", "cancelled"].includes(order.status);
  const quoteUrl = new URL(`/orcamento/${order.quoteToken}`, process.env.BETTER_AUTH_URL).toString();
  const defaultValidity = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const recommendedDays = order.items.map((item) => data.catalog.find((catalogItem) => catalogItem.id === item.serviceCatalogId)?.defaultReturnIntervalDays ?? null).find((days) => days !== null) ?? null;
  const orderNumber = order.orderNumber ? formatWorkOrderNumber(order.orderNumber) : `OS · #${order.id.slice(0, 8).toUpperCase()}`;
  const workOrderDraft = order.quoteStatus === "draft" ? null : buildWorkOrderDraft({
    phone: order.customerPhone,
    consent: order.customerWhatsappConsent,
    customer: order.customerName,
    workshop: data.workshop.name,
    vehicle: order.vehicleLabel,
    orderNumber,
    status: workOrderStatusLabels[order.status],
    total: formatCents(order.amountCents),
    orderUrl: quoteUrl,
  });

  return <AppShell workshopName={data.workshop.name} current="/ordens">
    <div className="order-heading"><div><a className="back-link" href="/ordens">← Voltar para ordens</a><p className="eyebrow">{orderNumber}</p><h1>{order.complaint || order.description}</h1><p>{order.customerName} · {order.vehicleLabel ?? "Sem veículo vinculado"}</p></div><div className="order-heading-actions">{workOrderDraft ? <WhatsAppLink href={workOrderDraft.url}>Enviar OS via WhatsApp</WhatsAppLink> : null}<a className="secondary-button" href={`/ordens/${order.id}/imprimir`} target="_blank">Imprimir A4</a><span className={`order-status status-${order.status}`}>{workOrderStatusLabels[order.status]}</span></div></div>
    <nav className="order-stepper" aria-label="Etapas da ordem"><span className={order.status === "open" ? "active" : "done"}>Entrada</span><span className={["diagnosis", "awaiting_approval", "approved", "in_progress", "ready", "delivered", "completed"].includes(order.status) ? "active" : ""}>Diagnóstico</span><span className={["awaiting_approval", "approved", "in_progress", "ready", "delivered", "completed"].includes(order.status) ? "active" : ""}>Orçamento</span><span className={["in_progress", "ready", "delivered", "completed"].includes(order.status) ? "active" : ""}>Execução</span><span className={["ready", "delivered", "completed"].includes(order.status) ? "active" : ""}>Entrega</span></nav>

    <div className="order-workspace">
      <div>
        <section className="surface"><div className="section-title"><div><span>00 · Recepção</span><h2>Vistoria de entrada</h2></div>{order.inspection ? <strong>Registrada</strong> : null}</div><IntakeInspectionForm serviceRecordId={order.id} defaults={order.inspection} /></section>
        <section className="surface"><div className="section-title"><div><span>01 · Entrada e análise</span><h2>Diagnóstico</h2></div></div><form action={saveDiagnosisAction} className="form-grid"><input type="hidden" name="serviceRecordId" value={order.id} /><label className="span-2">Relato do cliente<textarea name="complaint" required rows={3} defaultValue={order.complaint ?? order.description} disabled={finalStatus} /></label><label className="span-2">Diagnóstico técnico<textarea name="diagnosis" required rows={4} defaultValue={order.diagnosis ?? ""} placeholder="Causa encontrada, testes e recomendações" disabled={finalStatus} /></label><label className="span-2">Observações internas<textarea name="notes" rows={2} defaultValue={order.notes ?? ""} disabled={finalStatus} /></label>{!finalStatus ? <button className="secondary-button" type="submit">Salvar diagnóstico</button> : null}</form></section>

        <section className="surface"><div className="section-title"><div><span>02 · Proposta ao cliente</span><h2>Orçamento digital</h2></div><strong>{formatCents(order.amountCents)}</strong></div>{order.items.length ? <div className="quote-lines">{order.items.map((item) => <div key={item.id} className="quote-line-with-assignment"><div><span><strong>{item.description}</strong><small>{item.type === "service" ? "Serviço" : "Peça"} · {item.quantity} × {formatCents(item.unitPriceCents)}</small></span><b>{formatCents(item.quantity * item.unitPriceCents)}</b>{editableQuote ? <form action={removeQuoteItemAction}><input type="hidden" name="serviceRecordId" value={order.id} /><input type="hidden" name="itemId" value={item.id} /><button className="icon-button" type="submit" aria-label={`Remover ${item.description}`}>×</button></form> : null}</div>{item.type === "service" && !order.financialClosedAt ? <AssignmentForm serviceRecordId={order.id} workOrderItemId={item.id} collaborators={data.collaborators} assignments={data.assignments.filter((assignment) => assignment.workOrderItemId === item.id)} /> : item.type === "service" && data.assignments.some((assignment) => assignment.workOrderItemId === item.id) ? <small className="muted">Remuneração fechada e preservada no histórico.</small> : null}</div>)}</div> : <EmptyState title="Orçamento vazio" description="Adicione serviços e peças após concluir o diagnóstico." />}
          {editableQuote ? <><QuoteItemForm serviceRecordId={order.id} catalog={data.catalog} inventory={data.inventory} /><form action={publishQuoteAction} className="quote-publish-form"><input type="hidden" name="serviceRecordId" value={order.id} /><label>Desconto (R$)<input name="discount" inputMode="decimal" defaultValue={(order.quoteDiscountCents / 100).toFixed(2).replace(".", ",")} /></label><label>Válido até<input name="validUntil" type="date" defaultValue={order.quoteValidUntil?.toISOString().slice(0, 10) ?? defaultValidity} /></label><button className="primary-button" type="submit">Publicar orçamento</button></form></> : null}
          {order.quoteStatus !== "draft" ? <div className="quote-share"><div><span>Link seguro do cliente</span><a href={quoteUrl} target="_blank" rel="noreferrer">{quoteUrl}</a></div><span className={`quote-state quote-${order.quoteStatus}`}>{order.quoteStatus === "sent" ? "Aguardando resposta" : order.quoteStatus === "approved" ? "Aprovado" : "Recusado"}</span>{order.quoteStatus === "sent" ? <form action={shareQuoteWhatsAppAction}><input type="hidden" name="serviceRecordId" value={order.id} /><button className="primary-button" type="submit">Enviar pelo WhatsApp</button></form> : null}</div> : null}
        </section>

        <section className="surface"><div className="section-title"><div><span>03 · Evidências</span><h2>Fotos do veículo</h2></div></div>{order.photos.length ? <div className="photo-grid">{order.photos.map((photo) => <figure key={photo.id}><img src={`/api/photos/${photo.id}`} alt={photo.caption || photo.fileName} /><figcaption><strong>{photo.kind === "intake" ? "Entrada" : photo.kind === "diagnosis" ? "Diagnóstico" : "Conclusão"}</strong>{photo.caption ? <span>{photo.caption}</span> : null}</figcaption></figure>)}</div> : <p className="muted">Nenhuma foto adicionada.</p>}{!finalStatus ? <form action={uploadServicePhotoAction} className="photo-upload-form" encType="multipart/form-data"><input type="hidden" name="serviceRecordId" value={order.id} /><label>Etapa<select name="kind" defaultValue="diagnosis"><option value="intake">Entrada</option><option value="diagnosis">Diagnóstico</option><option value="completion">Conclusão</option></select></label><label>Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Legenda<input name="caption" placeholder="Ex.: vazamento encontrado" /></label><button className="secondary-button" type="submit">Adicionar foto</button><small>JPG, PNG ou WebP · máximo 2 MB</small></form> : null}</section>
      </div>

      <aside>
        <section className="surface order-control-card"><p className="eyebrow">PRÓXIMA AÇÃO</p>{order.status === "open" ? <><h2>Iniciar diagnóstico</h2><p>Registre a análise técnica para preparar o orçamento.</p>{statusAction(order.id, "diagnosis", "Iniciar diagnóstico")}</> : null}{order.status === "diagnosis" ? <><h2>Preparar orçamento</h2><p>Adicione os itens e publique o link para o cliente.</p></> : null}{order.status === "awaiting_approval" ? <><h2>Aguardando cliente</h2><p>O orçamento está disponível no link seguro. Se a resposta vier por telefone ou presencialmente, registre abaixo.</p><a className="secondary-button" href={quoteUrl} target="_blank" rel="noreferrer">Visualizar orçamento</a><div className="form-actions"><form action={recordOfflineQuoteDecisionAction}><input type="hidden" name="serviceRecordId" value={order.id} /><input type="hidden" name="decision" value="approved" /><button className="primary-button" type="submit">Registrar aprovação</button></form><form action={recordOfflineQuoteDecisionAction}><input type="hidden" name="serviceRecordId" value={order.id} /><input type="hidden" name="decision" value="rejected" /><button className="secondary-button" type="submit">Registrar recusa</button></form></div></> : null}{order.status === "approved" ? <><h2>Orçamento aprovado</h2><p>O cliente autorizou a versão {order.quoteVersion}.</p>{statusAction(order.id, "in_progress", "Iniciar execução")}<form action={reopenApprovedQuoteAction}><input type="hidden" name="serviceRecordId" value={order.id} /><button className="secondary-button" type="submit">Revisar orçamento</button></form></> : null}{order.status === "in_progress" ? <><h2>Serviço em execução</h2><p>Ao terminar, marque o veículo como pronto. Com a API oficial configurada, o aviso é disparado automaticamente.</p>{statusAction(order.id, "ready", "Marcar como pronto")}</> : null}{order.status === "ready" ? <><h2>Pronto para entrega</h2><p>Abra a conversa em outra janela e confirme o envio ao cliente.</p><ReadyWhatsAppAction serviceId={order.id} action={notifyServiceReadyAction} /></> : null}{["delivered", "completed"].includes(order.status) ? <><h2>Atendimento finalizado</h2><p>Entregue em {order.deliveredAt?.toLocaleDateString("pt-BR") ?? order.completedAt?.toLocaleDateString("pt-BR") ?? "data não informada"}.</p></> : null}{order.status === "cancelled" ? <><h2>OS cancelada</h2><p>Esta ordem foi encerrada sem entrega.</p></> : null}{!finalStatus && order.status !== "ready" ? <div className="danger-zone">{statusAction(order.id, "cancelled", "Cancelar OS", true)}</div> : null}</section>

        {order.status === "ready" ? <section className="surface"><div className="section-title"><div><span>04 · Entrega</span><h2>Finalizar OS</h2></div></div><FinalizationForm serviceRecordId={order.id} totalCents={order.amountCents} odometer={order.odometer} recommendedDays={recommendedDays} defaultTaxPercent={(order.taxBasisPoints ?? data.financialSettings.settings.defaultTaxBasisPoints) / 100} /></section> : null}

        <section className="surface order-facts"><div><span>Entrada</span><strong>{formatOptionalDate(order.intakeAt)}</strong></div><div><span>Quilometragem</span><strong>{order.odometer ? `${order.odometer.toLocaleString("pt-BR")} km` : "Não informada"}</strong></div><div><span>Subtotal</span><strong>{formatCents(order.subtotalCents)}</strong></div><div><span>Desconto</span><strong>{formatCents(order.quoteDiscountCents)}</strong></div><div><span>Total</span><strong>{formatCents(order.amountCents)}</strong></div></section>
        <section className="surface"><div className="section-title"><div><span>Auditoria</span><h2>Histórico da OS</h2></div></div><div className="timeline-list">{order.statusEvents.map((event) => <div key={event.id}><i /><div><strong>{workOrderStatusLabels[event.toStatus as keyof typeof workOrderStatusLabels] ?? event.toStatus}</strong><small>{event.occurredAt.toLocaleString("pt-BR")}</small>{event.note ? <span>{event.note}</span> : null}</div></div>)}</div></section>
      </aside>
    </div>
  </AppShell>;
}
