"use client";

import { useMemo, useState } from "react";
import { createWorkOrderAction } from "../app/actions";
import type { CustomerSummary, VehicleSummary } from "../server/ports";

export function WorkOrderForm({ customers, vehicles }: { customers: CustomerSummary[]; vehicles: VehicleSummary[] }) {
  const [customerId, setCustomerId] = useState("");
  const customerVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customerId === customerId), [customerId, vehicles]);

  return <form action={createWorkOrderAction} className="form-grid">
    <label>Cliente<select name="customerId" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="" disabled>Selecione o cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
    <label>Moto<select name="vehicleId" required defaultValue="" disabled={!customerId}><option value="" disabled>Selecione a moto</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model}</option>)}</select></label>
    <label>Quilometragem de entrada<input name="odometer" type="number" min="0" placeholder="24500" /></label>
    <label className="span-2">Relato do cliente<textarea name="complaint" required minLength={5} rows={3} placeholder="Descreva o motivo da entrada da moto" /></label>
    <label className="span-2">Observações internas<textarea name="notes" rows={2} placeholder="Acessórios entregues, avarias ou informações importantes" /></label>
    <button className="primary-button" type="submit">Abrir ordem de serviço</button>
  </form>;
}
