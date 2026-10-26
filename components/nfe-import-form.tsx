"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importInvoiceAction } from "../app/actions";
import { parseNfe, type NfeDocument } from "../domain/nfe";
import { formatCents } from "../domain/money";
import type { InvoiceReview } from "../server/nfe-intake";

export function NfeImportForm({ inventory }: { inventory: { id: string; name: string; sku?: string | null }[] }) {
  const [xml, setXml] = useState("");
  const [invoice, setInvoice] = useState<NfeDocument | null>(null);
  const [review, setReview] = useState<InvoiceReview[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  function update(line: number, values: Partial<InvoiceReview>) { setReview((rows) => rows.map((row) => row.line === line ? { ...row, ...values } : row)); }
  return <section className="surface"><div className="section-title"><div><span>Entrada por nota fiscal</span><h2>Importar NF-e (XML)</h2></div></div>
    <p className="field-hint">Selecione o XML recebido do fornecedor, confira produtos e quantidades e confirme a entrada. Notas em foto ou PDF ainda precisam do XML correspondente.</p>
    <input type="file" accept=".xml,text/xml,application/xml" aria-label="XML da nota fiscal" onChange={async (event) => {
      const file = event.target.files?.[0]; setInvoice(null); setMessage("");
      if (!file) return;
      try { if (file.size > 250000) throw new Error("Use um XML de até 250 KB."); const text = await file.text(); const parsed = parseNfe(text); setXml(text); setInvoice(parsed); setReview(parsed.items.map((item) => ({ line: item.line, inventoryItemId: null, include: true, quantity: item.quantity }))); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ler a nota."); }
    }} />
    {invoice ? <form onSubmit={async (event) => { event.preventDefault(); setPending(true); try { const result = await importInvoiceAction(xml, review); setMessage(result.duplicate ? "Esta nota já foi importada. Nenhum saldo foi alterado." : `${result.imported} produtos entraram no estoque.`); setInvoice(null); setXml(""); router.refresh(); } catch(error) { setMessage(error instanceof Error ? error.message : "Erro ao importar nota."); } finally { setPending(false); } }}>
      <p><strong>NF {invoice.number} · {invoice.supplier}</strong></p><div className="nfe-review-list">{invoice.items.map((item) => {
        const row = review.find((value) => value.line === item.line)!;
        return <div key={item.line}><label className="check-row"><input type="checkbox" checked={row.include} onChange={(event) => update(item.line, { include: event.target.checked })} />{item.name}</label><small>{item.quantity} {item.unit} na nota · {formatCents(item.totalCents)}</small>
          <label>Destino<select value={row.inventoryItemId ?? ""} onChange={(event) => update(item.line, { inventoryItemId: event.target.value || null })}><option value="">Criar produto desta nota</option>{inventory.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Unidades para o estoque<input type="number" min="1" step="1" required={row.include} disabled={!row.include} value={row.quantity} onChange={(event) => update(item.line, { quantity: Number(event.target.value) })} /></label></div>;
      })}</div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Importando…" : "Confirmar entrada no estoque"}</button></form> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
