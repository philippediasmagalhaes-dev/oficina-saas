"use client";

import { useState } from "react";
import { createManualFinancialEntryAction } from "../app/actions";
import { MoneyInput } from "./money-input";

type Category = { id: string; key: string; name: string; direction: string; active: boolean; protected: boolean };
type Supplier = { id: string; name: string };
type Account = { id: string; name: string };

export function FinancialEntryForm({ categories, suppliers, accounts, defaultDirection = "expense" }: { categories: Category[]; suppliers: Supplier[]; accounts: Account[]; defaultDirection?: "income" | "expense" | "reserve" }) {
  const [direction, setDirection] = useState(defaultDirection);
  const available = categories.filter((category) => category.active && !category.protected && category.direction === direction);
  const today = new Date().toISOString().slice(0, 10);
  return <form action={createManualFinancialEntryAction} className="financial-entry-form">
    <label>Tipo<select name="direction" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="expense">Conta a pagar</option><option value="income">Conta a receber</option><option value="reserve">Reserva</option></select></label>
    <label>Categoria<select name="category" key={direction} defaultValue={available[0]?.key ?? ""} required>{available.map((category) => <option value={category.key} key={category.id}>{category.name}</option>)}</select></label>
    {direction === "expense" ? <label>Fornecedor<select name="supplierId" defaultValue=""><option value="">Não informado</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label> : <input type="hidden" name="supplierId" value="" />}
    <label>Conta<select name="financialAccountId" defaultValue=""><option value="">Definir na baixa</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
    <label className="span-2">Descrição<input name="description" required placeholder="Ex.: compra de peças, aluguel, recebimento avulso" /></label>
    <label>Documento<input name="documentNumber" placeholder="NF, boleto ou referência" /></label>
    <label>Valor total<MoneyInput name="amount" defaultValue="0,00" required /></label>
    <label>Parcelas<input name="installmentCount" type="number" min="1" max="48" defaultValue="1" /></label>
    <label>Competência<input name="competenceDate" type="date" defaultValue={today} required /></label>
    <label>Primeiro vencimento<input name="dueDate" type="date" defaultValue={today} required /></label>
    <label className="span-2">Observações<input name="notes" placeholder="Informação interna opcional" /></label>
    <label className="checkbox-label"><input name="settled" type="checkbox" /> Já recebido/pago</label>
    <label className="checkbox-label"><input name="recurringMonthly" type="checkbox" /> Repetir mensalmente</label>
    <button className="primary-button span-2" type="submit">Salvar título</button>
  </form>;
}
