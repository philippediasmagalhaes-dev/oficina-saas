"use client";

import { useMemo, useState } from "react";
import { recordServiceAction } from "../app/actions";
import { deriveNextDueDateValue } from "../domain/forecast";
import type {
  CustomerSummary,
  InventorySummary,
  ServiceCatalogSummary,
  VehicleSummary,
} from "../server/ports";

function currencyInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function ServiceForm({
  customers,
  vehicles,
  catalog,
  inventory,
}: {
  customers: CustomerSummary[];
  vehicles: VehicleSummary[];
  catalog: ServiceCatalogSummary[];
  inventory: InventorySummary[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [amount, setAmount] = useState("");
  const [returnDays, setReturnDays] = useState("");
  const [completedAt, setCompletedAt] = useState(todayInputValue);
  const [nextDueAt, setNextDueAt] = useState("");
  const customerVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.customerId === customerId),
    [customerId, vehicles],
  );

  function updateForecast(date: string, days: string) {
    const interval =
      /^\d+$/.test(days) && Number(days) > 0 ? Number(days) : null;
    setNextDueAt(deriveNextDueDateValue(date, interval));
  }

  function selectCatalog(id: string) {
    setCatalogId(id);
    const item = catalog.find((entry) => entry.id === id);
    const days = item?.defaultReturnIntervalDays
      ? String(item.defaultReturnIntervalDays)
      : "";
    setAmount(item ? currencyInput(item.defaultPriceCents) : "");
    setReturnDays(days);
    updateForecast(completedAt, days);
  }

  return (
    <form action={recordServiceAction} className="form-grid">
      <label className="span-2">
        Cliente
        <select
          name="customerId"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          <option value="" disabled>
            Selecione um cliente
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Veículo
        <select name="vehicleId" defaultValue="" disabled={!customerId}>
          <option value="">Sem veículo vinculado</option>
          {customerVehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate} · {vehicle.make} {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Serviço
        <select
          name="serviceCatalogId"
          required
          value={catalogId}
          onChange={(event) => selectCatalog(event.target.value)}
        >
          <option value="" disabled>
            Selecione um serviço cadastrado
          </option>
          {catalog
            .filter((item) => item.active)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {currencyInput(item.defaultPriceCents)}
              </option>
            ))}
        </select>
      </label>
      <label>
        Valor cobrado (R$)
        <input
          name="amount"
          required
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="350,00"
        />
      </label>
      <label>
        Data do serviço
        <input
          name="completedAt"
          type="date"
          required
          value={completedAt}
          onChange={(event) => {
            const date = event.target.value;
            setCompletedAt(date);
            updateForecast(date, returnDays);
          }}
        />
      </label>
      <label>
        Quilometragem
        <input name="odometer" type="number" min="0" />
      </label>
      <label>
        Retorno em dias
        <input
          name="returnIntervalDays"
          type="number"
          min="1"
          value={returnDays}
          onChange={(event) => {
            const days = event.target.value;
            setReturnDays(days);
            updateForecast(completedAt, days);
          }}
          placeholder="180"
        />
      </label>
      <label>
        Data prevista
        <input
          name="nextDueAt"
          type="date"
          value={nextDueAt}
          onChange={(event) => setNextDueAt(event.target.value)}
        />
        <small className="field-hint">
          Preenchida pelo prazo do serviço e ainda editável.
        </small>
      </label>
      <label>
        Item consumido
        <select name="inventoryItemId" defaultValue="">
          <option value="">Nenhum</option>
          {inventory
            .filter((item) => item.active)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.currentQuantity} {item.unit}
              </option>
            ))}
        </select>
      </label>
      <label>
        Quantidade usada
        <input name="inventoryQuantity" type="number" min="1" />
      </label>
      <label className="span-2">
        Observações
        <textarea name="notes" rows={3} placeholder="Detalhes do atendimento" />
      </label>
      <button className="primary-button" type="submit">
        Registrar serviço
      </button>
    </form>
  );
}
