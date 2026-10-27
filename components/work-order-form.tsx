"use client";

import { useEffect, useState } from "react";
import { createWorkOrderAction } from "../app/actions";
import type { CustomerSummary, VehicleSummary } from "../server/ports";
import { CustomerPicker } from "./customer-picker";

export function WorkOrderForm({ customers, vehicles, initialCustomerId = "", initialVehicleId = "" }: { customers: CustomerSummary[]; vehicles: VehicleSummary[]; initialCustomerId?: string; initialVehicleId?: string }) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [customerVehicles, setCustomerVehicles] = useState(vehicles.filter((vehicle) => vehicle.customerId === customerId));
  const [error, setError] = useState("");
  useEffect(() => {
    setCustomerVehicles([]); setError("");
    if (!customerId) return;
    const controller = new AbortController();
    void fetch(`/api/veiculos/opcoes?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error();
      setCustomerVehicles(rows);
      if (!rows.length) setError("Este cliente ainda não tem um veículo cadastrado.");
    }).catch(() => { if (!controller.signal.aborted) setError("Não foi possível buscar os veículos. Selecione o cliente novamente."); });
    return () => controller.abort();
  }, [customerId]);

  return <form action={createWorkOrderAction} className="form-grid">
    <CustomerPicker customers={customers} defaultCustomerId={initialCustomerId} onChange={(id) => { setCustomerId(id); setVehicleId(""); }} />
    <label>Veículo<select name="vehicleId" required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={!customerId}><option value="" disabled>Selecione o veículo</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model}</option>)}</select></label>
    {error ? <p className="field-hint span-2" role="status">{error} <a href="/veiculos?nova=1#novo" target="_blank" rel="noreferrer">Cadastrar veículo</a></p> : null}
    <label>Quilometragem de entrada<input name="odometer" type="number" min="0" placeholder="24500" /></label>
    <label className="span-2">Relato do cliente<textarea name="complaint" required minLength={5} rows={3} placeholder="Descreva o motivo da entrada do veículo" /></label>
    <label className="span-2">Observações internas<textarea name="notes" rows={2} placeholder="Acessórios entregues, avarias ou informações importantes" /></label>
    <button className="primary-button" type="submit">Abrir ordem de serviço</button>
  </form>;
}
