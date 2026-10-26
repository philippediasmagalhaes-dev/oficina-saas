import { AppShell } from "../../components/app-shell";
import { getOwnerContext } from "../../server/owner-context";
import { listApprovalNotifications } from "../../server/notifications";

export default async function NotificationsPage() {
  const { workshop, workshopId } = await getOwnerContext();
  const items = await listApprovalNotifications(workshopId);
  return <AppShell workshopName={workshop.name} current="/notificacoes"><section className="surface"><h1>Notificações</h1><p>Aprovações dos últimos sete dias.</p><div className="card-list">{items.map((item) => <a className="list-card" key={item.id} href={`/ordens/${item.serviceRecordId}`}><strong>OS {item.orderNumber ?? ""} aprovada</strong><span>{item.customerName}</span><small>{item.decidedAt.toLocaleString("pt-BR")}</small></a>)}</div>{!items.length ? <p>Nenhuma aprovação recente.</p> : null}</section></AppShell>;
}
