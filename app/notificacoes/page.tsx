import { AppShell } from "../../components/app-shell";
import { getOwnerContext } from "../../server/owner-context";
import { listApprovalNotifications } from "../../server/notifications";

export default async function NotificationsPage() {
  const { workshop, workshopId } = await getOwnerContext();
  const items = await listApprovalNotifications(workshopId);
  return <AppShell workshopName={workshop.name} current="/notificacoes"><div className="page-heading"><div><p className="eyebrow">NOTIFICAÇÕES</p><h1>Atualizações importantes</h1><p>Aprovações de orçamento registradas nos últimos sete dias.</p></div></div><section className="surface compact-list-surface"><div className="card-list">{items.map((item) => <a className="list-card" key={item.id} href={`/ordens/${item.serviceRecordId}`}><strong>OS {item.orderNumber ?? ""} aprovada</strong><span>{item.customerName}</span><small>{item.decidedAt.toLocaleString("pt-BR")}</small></a>)}</div>{!items.length ? <p className="dashboard-clear">Nenhuma aprovação recente.</p> : null}</section></AppShell>;
}
