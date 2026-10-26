import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { InventoryAdjustmentForm, InventoryItemForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getInventory } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";
import { NfeImportForm } from "../../components/nfe-import-form";

export default async function InventoryPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getInventory();
  return <AppShell workshopName={data.workshop.name} current="/estoque">
    <div className="page-heading"><div><p className="eyebrow">ESTOQUE</p><h1>Controle só o essencial.</h1><p>Entradas, consumo por serviço e alerta de reposição sem complexidade.</p></div></div>
    <NfeImportForm inventory={data.inventory} />
    <section className="surface"><div className="section-title"><div><span>Novo produto</span><h2>Adicionar item</h2></div></div><InventoryItemForm /></section>
    <section className="surface"><div className="section-title"><div><span>{data.inventory.length} itens</span><h2>Posição atual</h2></div></div>{data.inventory.length ? <div className="inventory-grid">{data.inventory.map((item) => { const available = item.currentQuantity - (item.reservedQuantity ?? 0); const low = available <= item.minimumQuantity; return <article className={low ? "inventory-card low" : "inventory-card"} key={item.id}><div className="inventory-top"><div><span>{item.sku || "SEM SKU"}</span><h3>{item.name}</h3></div>{low ? <b>Repor</b> : <b className="ok">Em dia</b>}</div><div className="stock-number"><strong>{available}</strong><span>{item.unit} disponíveis<br />{item.currentQuantity} físicos · {item.reservedQuantity ?? 0} reservados</span></div><p>Mínimo {item.minimumQuantity} · custo {formatCents(item.costCents)} · venda {formatCents(item.salePriceCents)}</p><InventoryAdjustmentForm item={item} /></article>; })}</div> : <EmptyState title="Estoque vazio" description="Adicione os itens que você realmente acompanha no dia a dia." />}</section>
    <section className="surface"><div className="section-title"><div><span>Auditoria</span><h2>Últimas movimentações</h2></div></div>{data.movements.length ? <div className="finance-list">{data.movements.map((movement) => <div key={movement.id}><span><strong>{movement.itemName}</strong><small>{movement.orderNumber ? `OS Nº ${movement.orderNumber} · ` : ""}{movement.note ?? movement.type} · {movement.createdAt.toLocaleString("pt-BR")}</small></span><b>{movement.quantityDelta ? `${movement.quantityDelta > 0 ? "+" : ""}${movement.quantityDelta}` : `${movement.reservationDelta > 0 ? "+" : ""}${movement.reservationDelta} reserva`}</b></div>)}</div> : <EmptyState title="Sem movimentações" description="Entradas, reservas e consumos aparecerão aqui." />}</section>
  </AppShell>;
}
