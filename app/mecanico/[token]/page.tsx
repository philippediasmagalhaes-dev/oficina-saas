import { notFound } from "next/navigation";
import { IntakeInspectionForm } from "../../../components/intake-inspection-form";
import { NumericFieldBehavior } from "../../../components/numeric-field-behavior";
import { verifyMechanicAccess } from "../../../server/mechanic-access";
import { getWorkOrder } from "../../../server/work-orders";
import { workOrderStatusLabels } from "../../../domain/work-orders";
import { saveMechanicInspectionAction, saveMechanicWorkAction, uploadMechanicPhotoAction } from "../actions";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function MechanicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = await verifyMechanicAccess(token, process.env.BETTER_AUTH_SECRET ?? "");
  if (!grant) return <main className="mechanic-workspace"><section className="surface"><h1>Acesso expirado</h1><p>Peça ao proprietário um novo link para esta OS.</p></section></main>;
  const order = await getWorkOrder(grant.workshopId, grant.serviceRecordId);
  if (!order) notFound();
  const closed = ["completed", "delivered", "cancelled"].includes(order.status);
  const editableDiagnosis = ["open", "diagnosis"].includes(order.status);
  return <main className="mechanic-workspace"><NumericFieldBehavior />
    <header className="surface"><img src="/logo.jpg" width="110" alt="Paulinho Autocar" /><p className="eyebrow">ÁREA DE EXECUÇÃO · OS {order.orderNumber ?? ""}</p><h1>{order.vehicleLabel}</h1><p>{order.customerName} · {workOrderStatusLabels[order.status]}</p><small>Link válido até {new Date(grant.expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</small></header>
    <section className="surface"><h2>Solicitação e serviços</h2><p>{order.complaint ?? order.description}</p><ul>{order.items.map((item) => <li key={item.id}>{item.quantity} × {item.description}</li>)}</ul></section>
    {!closed ? <>
      <section className="surface"><h2>Preenchimento técnico</h2><form action={saveMechanicWorkAction} className="form-grid"><input type="hidden" name="mechanicToken" value={token} />
        <label>Quilometragem<input type="number" min="0" name="odometer" defaultValue={order.odometer ?? ""} /></label>
        {editableDiagnosis ? <label className="span-2">Diagnóstico<textarea name="diagnosis" rows={4} defaultValue={order.diagnosis ?? ""} /></label> : <p className="span-2">Diagnóstico: {order.diagnosis ?? "Não informado"}</p>}
        <label className="span-2">Execução e recomendações<textarea name="mechanicNotes" rows={5} defaultValue={order.mechanicNotes ?? ""} /></label>
        <button className="primary-button" name="task" value="save">Salvar preenchimento</button>
        {order.status === "approved" ? <button className="secondary-button" name="task" value="start">Iniciar execução</button> : null}
        {order.status === "in_progress" ? <button className="secondary-button" name="task" value="ready">Concluir e marcar pronto</button> : null}
      </form></section>
      <section className="surface"><h2>Vistoria e avarias</h2><IntakeInspectionForm serviceRecordId={order.id} defaults={order.inspection} action={saveMechanicInspectionAction} mechanicToken={token} /></section>
      <section className="surface"><h2>Fotos da execução</h2><p>{order.photos.length} fotos registradas.</p><form action={uploadMechanicPhotoAction} className="form-grid" encType="multipart/form-data"><input type="hidden" name="mechanicToken" value={token} /><label>Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Legenda<input name="caption" /></label><button className="secondary-button">Enviar foto</button></form></section>
    </> : <section className="surface"><h2>OS encerrada</h2><p>O preenchimento está concluído.</p></section>}
  </main>;
}
