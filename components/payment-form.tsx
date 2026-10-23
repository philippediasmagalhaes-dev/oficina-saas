"use client";

import { useMemo, useState } from "react";
import { formatCents } from "../domain/money";

type PaymentRow = { key: number; paymentMethod: string; amount: string; installmentCount: string; paid: boolean; expectedAt: string; manualFee: string };

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function currencyInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function inputCents(value: string) {
  const number = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function PaymentForm({ totalCents }: { totalCents: number }) {
  const [nextKey, setNextKey] = useState(2);
  const [rows, setRows] = useState<PaymentRow[]>([{ key: 1, paymentMethod: "pix", amount: currencyInput(totalCents), installmentCount: "1", paid: true, expectedAt: today(), manualFee: "" }]);
  const paidCents = useMemo(() => rows.reduce((sum, row) => sum + inputCents(row.amount), 0), [rows]);
  const payload = JSON.stringify(rows.map(({ key: _key, ...row }) => row));
  const update = (key: number, values: Partial<PaymentRow>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
  const add = () => { const remaining = Math.max(0, totalCents - paidCents); setRows((current) => [...current, { key: nextKey, paymentMethod: "pix", amount: currencyInput(remaining), installmentCount: "1", paid: true, expectedAt: today(), manualFee: "" }]); setNextKey((value) => value + 1); };

  return <div className="span-2 payment-editor">
    <input type="hidden" name="payments" value={payload} />
    <div className="payment-summary"><strong>Pagamentos</strong><span className={paidCents === totalCents ? "ok" : "warning"}>{formatCents(paidCents)} de {formatCents(totalCents)}</span></div>
    {rows.map((row) => <div className="payment-row" key={row.key}>
      <label>Forma<select value={row.paymentMethod} onChange={(event) => update(row.key, { paymentMethod: event.target.value })}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
      <label>Valor<input value={row.amount} inputMode="decimal" onChange={(event) => update(row.key, { amount: event.target.value })} /></label>
      <label>Parcelas<input type="number" min="1" max="24" value={row.installmentCount} onChange={(event) => update(row.key, { installmentCount: event.target.value })} /></label>
      <label>Vencimento<input type="date" value={row.expectedAt} onChange={(event) => update(row.key, { expectedAt: event.target.value })} /></label>
      <label>Taxa manual<input value={row.manualFee} inputMode="decimal" placeholder="usar regra" onChange={(event) => update(row.key, { manualFee: event.target.value })} /></label>
      <label className="payment-paid"><input type="checkbox" checked={row.paid} onChange={(event) => update(row.key, { paid: event.target.checked })} /> Recebido</label>
      {rows.length > 1 ? <button className="text-button" type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>Remover</button> : null}
    </div>)}
    <button className="secondary-button" type="button" onClick={add}>Dividir pagamento</button>
    {paidCents !== totalCents ? <small className="form-warning">A soma deve fechar exatamente em {formatCents(totalCents)}.</small> : null}
  </div>;
}
