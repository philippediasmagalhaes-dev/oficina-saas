"use client";

import { useState } from "react";
import { createManualFinancialEntryAction } from "../app/actions";
import { MoneyInput } from "./money-input";

export function ManualFinancialEntryForm({ categories }: { categories: { id: string; key: string; name: string; direction: string; active: boolean; protected: boolean }[] }) {
  const [direction, setDirection] = useState("expense");
  const available = categories.filter((category) => category.active && !category.protected && category.direction === direction);
  const today = new Date().toISOString().slice(0, 10);
  return <form action={createManualFinancialEntryAction} className="form-grid compact-form">
    <label>Tipo<select name="direction" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option><option value="reserve">Reserva</option></select></label>
    <label>Categoria<select name="category" key={direction} defaultValue={available.find((category) => category.key === "operational")?.key ?? available[0]?.key ?? ""} required>{available.map((category) => <option value={category.key} key={category.id}>{category.name}</option>)}</select></label>
    <label className="span-2">Descrição<input name="description" required placeholder="Ex.: aluguel, fornecedor, receita avulsa" /></label>
    <label>Valor<MoneyInput name="amount" required defaultValue="0,00" /></label>
    <label>Competência<input name="competenceDate" type="date" required defaultValue={today} /></label>
    <label>Vencimento<input name="dueDate" type="date" required defaultValue={today} /></label>
    <label className="checkbox-label"><input name="settled" type="checkbox" /> Já realizado</label>
    <label className="checkbox-label"><input name="recurringMonthly" type="checkbox" /> Recorrente mensal</label>
    <button className="secondary-button span-2" type="submit">Adicionar lançamento</button>
  </form>;
}
