import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { InventoryAdjustmentForm, InventoryItemForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getInventory } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function InventoryPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getInventory();
  return <AppShell workshopName={data.workshop.name} current="/estoque">
    <div className="page-heading"><div><p className="eyebrow">ESTOQUE</p><h1>Controle só o essencial.</h1><p>Entradas, consumo por serviço e alerta de reposição sem complexidade.</p></div></div>
    <section className="surface"><div className="section-title"><div><span>Novo produto</span><h2>Adicionar item</h2></div></div><InventoryItemForm /></section>
    <section className="surface"><div className="section-title"><div><span>{data.inventory.length} itens</span><h2>Posição atual</h2></div></div>{data.inventory.length ? <div className="inventory-grid">{data.inventory.map((item) => { const low = item.currentQuantity <= item.minimumQuantity; return <article className={low ? "inventory-card low" : "inventory-card"} key={item.id}><div className="inventory-top"><div><span>{item.sku || "SEM SKU"}</span><h3>{item.name}</h3></div>{low ? <b>Repor</b> : <b className="ok">Em dia</b>}</div><div className="stock-number"><strong>{item.currentQuantity}</strong><span>{item.unit} em estoque<br />mínimo {item.minimumQuantity}</span></div><p>Custo {formatCents(item.costCents)} · Venda {formatCents(item.salePriceCents)}</p><InventoryAdjustmentForm item={item} /></article>; })}</div> : <EmptyState title="Estoque vazio" description="Adicione os itens que você realmente acompanha no dia a dia." />}</section>
  </AppShell>;
}
