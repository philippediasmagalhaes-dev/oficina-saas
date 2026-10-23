"use client";

import { useState } from "react";
import { finalizeWorkOrderAction } from "../app/actions";
import { deriveNextDueDateValue } from "../domain/forecast";
import { PaymentForm } from "./payment-form";

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function FinalizationForm({ serviceRecordId, totalCents, odometer, recommendedDays, defaultTaxPercent }: { serviceRecordId: string; totalCents: number; odometer: number | null; recommendedDays: number | null; defaultTaxPercent: number }) {
  const [returnDays, setReturnDays] = useState(recommendedDays ? String(recommendedDays) : "");
  const [nextDueAt, setNextDueAt] = useState(recommendedDays ? deriveNextDueDateValue(today(), recommendedDays) : "");

  return <form action={finalizeWorkOrderAction} className="form-grid compact-form">
    <input type="hidden" name="serviceRecordId" value={serviceRecordId} />
    <PaymentForm totalCents={totalCents} />
    <label>Reserva de imposto (%)<input name="taxPercent" type="number" min="0" max="100" step="0.01" defaultValue={defaultTaxPercent} /><small className="field-hint">Estimativa editável para esta OS.</small></label>
    <label>Km de saída<input name="deliveredOdometer" type="number" min="0" defaultValue={odometer ?? ""} /></label>
    <label>Garantia em dias<input name="warrantyDays" type="number" min="0" defaultValue="90" /></label>
    <label>Retorno em dias<input name="returnIntervalDays" type="number" min="1" value={returnDays} onChange={(event) => { const days = event.target.value; setReturnDays(days); setNextDueAt(/^\d+$/.test(days) && Number(days) > 0 ? deriveNextDueDateValue(today(), Number(days)) : ""); }} placeholder="180" /></label>
    <label>Próxima manutenção<input name="nextDueAt" type="date" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} /><small className="field-hint">Calculada automaticamente e editável.</small></label>
    <button className="primary-button span-2" type="submit">Confirmar entrega</button>
  </form>;
}
