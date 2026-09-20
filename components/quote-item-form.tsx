"use client";

import { useState } from "react";
import { addQuoteItemAction } from "../app/actions";
import type { InventorySummary, ServiceCatalogSummary } from "../server/ports";

function money(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function QuoteItemForm({ serviceRecordId, catalog, inventory }: { serviceRecordId: string; catalog: ServiceCatalogSummary[]; inventory: InventorySummary[] }) {
  const [type, setType] = useState<"service" | "part">("service");
  const [referenceId, setReferenceId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const entries = type === "service" ? catalog.filter((item) => item.active) : inventory.filter((item) => item.active);

  function selectReference(id: string) {
    setReferenceId(id);
    if (type === "service") {
      const item = catalog.find((entry) => entry.id === id);
      setUnitPrice(item ? money(item.defaultPriceCents) : "");
    } else {
      const item = inventory.find((entry) => entry.id === id);
      setUnitPrice(item ? money(item.salePriceCents) : "");
    }
  }

  return <form action={addQuoteItemAction} className="quote-item-form">
    <input type="hidden" name="serviceRecordId" value={serviceRecordId} />
    <label>Tipo<select name="type" value={type} onChange={(event) => { const next = event.target.value as "service" | "part"; setType(next); setReferenceId(""); setUnitPrice(""); }}><option value="service">Serviço</option><option value="part">Peça</option></select></label>
    <label>Item<select name="referenceId" required value={referenceId} onChange={(event) => selectReference(event.target.value)}><option value="" disabled>Selecione</option>{entries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Qtd.<input name="quantity" type="number" min="1" required defaultValue="1" /></label>
    <label>Valor unitário<input name="unitPrice" inputMode="decimal" required value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" /></label>
    <button className="secondary-button" type="submit">Adicionar</button>
  </form>;
}
