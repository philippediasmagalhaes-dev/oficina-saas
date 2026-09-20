"use client";

import { useState } from "react";
import { finalizeWorkOrderAction } from "../app/actions";
import { deriveNextDueDateValue } from "../domain/forecast";

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function FinalizationForm({ serviceRecordId, odometer, recommendedDays }: { serviceRecordId: string; odometer: number | null; recommendedDays: number | null }) {
  const [returnDays, setReturnDays] = useState(recommendedDays ? String(recommendedDays) : "");
  const [nextDueAt, setNextDueAt] = useState(recommendedDays ? deriveNextDueDateValue(today(), recommendedDays) : "");

  return <form action={finalizeWorkOrderAction} className="form-grid compact-form">
    <input type="hidden" name="serviceRecordId" value={serviceRecordId} />
    <label>Pagamento<select name="paymentStatus" defaultValue="paid"><option value="paid">Pago</option><option value="pending">Pendente</option></select></label>
    <label>Forma<select name="paymentMethod" defaultValue="pix"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="outro">Outro</option></select></label>
    <label>Km de saída<input name="deliveredOdometer" type="number" min="0" defaultValue={odometer ?? ""} /></label>
    <label>Garantia em dias<input name="warrantyDays" type="number" min="0" defaultValue="90" /></label>
    <label>Retorno em dias<input name="returnIntervalDays" type="number" min="1" value={returnDays} onChange={(event) => { const days = event.target.value; setReturnDays(days); setNextDueAt(/^\d+$/.test(days) && Number(days) > 0 ? deriveNextDueDateValue(today(), Number(days)) : ""); }} placeholder="180" /></label>
    <label>Próxima manutenção<input name="nextDueAt" type="date" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} /><small className="field-hint">Calculada automaticamente e editável.</small></label>
    <button className="primary-button span-2" type="submit">Confirmar entrega</button>
  </form>;
}
