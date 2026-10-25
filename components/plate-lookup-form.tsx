"use client";

import { useState } from "react";
import { createVehicleAction, updateVehicleAction } from "../app/actions";
import { normalizePlate } from "../domain/workshop-settings";
import type { CustomerSummary, VehicleSummary } from "../server/ports";

type Values = { plate: string; make: string; model: string; category: string; color: string; manufactureYear: string; modelYear: string; fuel: string; engineDisplacement: string; power: string; municipality: string; state: string; maskedChassis: string; odometer: string; lookupProvider: string; lookupSnapshot: string };
type LookupState = "idle" | "loading" | "found" | "manual";

export function canRequestPlateLookup(lastSuccessfulPlate: string | null, currentPlate: string, state: LookupState) {
  const plate = normalizePlate(currentPlate);
  return state !== "loading" && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) && plate !== lastSuccessfulPlate;
}

export function plateLookupSuccessMessage(result: { cached: boolean; balanceCents: number | null }) {
  if (result.cached) return "Dados reaproveitados do histórico, sem nova cobrança.";
  const balance = result.balanceCents === null
    ? ""
    : ` Saldo no provedor: R$ ${(result.balanceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
  return `Consulta concluída por R$ 0,08.${balance}`;
}

export function resetPlateLookupMetadata(currentPlate: string, nextPlate: string) {
  return normalizePlate(currentPlate) === normalizePlate(nextPlate)
    ? null
    : { lookupProvider: "", lookupSnapshot: "" };
}

export function createPlateLookupRequest(plate: string, origin = window.location.origin) {
  const url = new URL("/api/veiculos/consultar-placa", origin);
  url.searchParams.set("plate", plate);
  return new Request(url, { cache: "no-store" });
}

export function PlateLookupForm({ customers, vehicle }: { customers: CustomerSummary[]; vehicle?: VehicleSummary }) {
  const [values, setValues] = useState<Values>({ plate: vehicle?.plate ?? "", make: vehicle?.make ?? "", model: vehicle?.model ?? "", category: vehicle?.category ?? "car", color: vehicle?.color ?? "", manufactureYear: String(vehicle?.manufactureYear ?? ""), modelYear: String(vehicle?.modelYear ?? vehicle?.year ?? ""), fuel: vehicle?.fuel ?? "", engineDisplacement: vehicle?.engineDisplacement ?? "", power: vehicle?.power ?? "", municipality: vehicle?.municipality ?? "", state: vehicle?.state ?? "", maskedChassis: vehicle?.maskedChassis ?? "", odometer: String(vehicle?.odometer ?? ""), lookupProvider: vehicle?.lookupProvider ?? "", lookupSnapshot: vehicle?.lookupSnapshot ? JSON.stringify(vehicle.lookupSnapshot) : "" });
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lastSuccessfulPlate, setLastSuccessfulPlate] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const set = (name: keyof Values, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const lookup = async () => {
    setLookupState("loading"); setMessage("Consultando placa…");
    try {
      const response = await fetch(createPlateLookupRequest(values.plate));
      const result = await response.json() as { status: string; message?: string; provider?: string; data?: Partial<Record<keyof Values, string | number | null>>; snapshot?: Record<string, unknown>; cached?: boolean; balanceCents?: number | null };
      if (result.status !== "found" || !result.data) { setLookupState("manual"); setMessage(result.message ?? "Preencha os dados manualmente."); return; }
      setValues((current) => ({ ...current, plate: String(result.data?.plate ?? current.plate), make: String(result.data?.make ?? current.make), model: String(result.data?.model ?? current.model), color: String(result.data?.color ?? current.color), manufactureYear: String(result.data?.manufactureYear ?? current.manufactureYear), modelYear: String(result.data?.modelYear ?? current.modelYear), fuel: String(result.data?.fuel ?? current.fuel), engineDisplacement: String(result.data?.engineDisplacement ?? current.engineDisplacement), power: String(result.data?.power ?? current.power), municipality: String(result.data?.municipality ?? current.municipality), state: String(result.data?.state ?? current.state), maskedChassis: String(result.data?.maskedChassis ?? current.maskedChassis), lookupProvider: result.provider ?? "", lookupSnapshot: JSON.stringify(result.snapshot ?? {}) }));
      setLastSuccessfulPlate(normalizePlate(String(result.data.plate ?? values.plate)));
      setLookupState("found"); setMessage(plateLookupSuccessMessage({ cached: Boolean(result.cached), balanceCents: result.balanceCents ?? null }));
    } catch { setLookupState("manual"); setMessage("Consulta indisponível. Continue o cadastro manualmente."); }
  };
  return <form action={vehicle ? updateVehicleAction : createVehicleAction} className="form-grid">
    {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
    <input type="hidden" name="lookupProvider" value={values.lookupProvider} /><input type="hidden" name="lookupSnapshot" value={values.lookupSnapshot} /><input name="year" type="hidden" value={values.modelYear} />
    <label className="span-2">Proprietário<select name="customerId" required defaultValue={vehicle?.customerId ?? ""}><option value="" disabled>Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
    <div className="plate-lookup-row span-2"><label>Placa<input name="plate" required placeholder="ABC1D23" value={values.plate} onChange={(event) => { const plate = event.target.value.toUpperCase(); const reset = resetPlateLookupMetadata(values.plate, plate); setValues((current) => ({ ...current, plate, ...(reset ?? {}) })); if (normalizePlate(plate) !== lastSuccessfulPlate) { setLookupState("idle"); setMessage(""); } }} /></label><button className="secondary-button" type="button" disabled={!canRequestPlateLookup(lastSuccessfulPlate, values.plate, lookupState)} onClick={lookup}>{lookupState === "loading" ? "Consultando…" : "Consultar placa"}</button>{message ? <small className={lookupState === "found" ? "ok" : "muted"}>{message}</small> : null}</div>
    <label>Marca<input name="make" required placeholder="Chevrolet" value={values.make} onChange={(event) => set("make", event.target.value)} /></label>
    <label>Modelo<input name="model" required placeholder="Corsa" value={values.model} onChange={(event) => set("model", event.target.value)} /></label>
    <label>Categoria<select name="category" value={values.category} onChange={(event) => set("category", event.target.value)}><option value="car">Carro</option><option value="two_wheels">Duas rodas</option><option value="utility">Utilitário</option><option value="other">Outro</option></select></label>
    <label>Cor<input name="color" value={values.color} onChange={(event) => set("color", event.target.value)} /></label>
    <label>Ano fabricação<input name="manufactureYear" type="number" min="1900" max="2100" value={values.manufactureYear} onChange={(event) => set("manufactureYear", event.target.value)} /></label>
    <label>Ano modelo<input name="modelYear" type="number" min="1900" max="2100" value={values.modelYear} onChange={(event) => set("modelYear", event.target.value)} /></label>
    <label>Combustível<input name="fuel" value={values.fuel} onChange={(event) => set("fuel", event.target.value)} /></label><label>Cilindrada<input name="engineDisplacement" placeholder="1.6" value={values.engineDisplacement} onChange={(event) => set("engineDisplacement", event.target.value)} /></label>
    <label>Potência<input name="power" placeholder="92 cv" value={values.power} onChange={(event) => set("power", event.target.value)} /></label><label>Chassi mascarado<input name="maskedChassis" placeholder="*****123456" value={values.maskedChassis} onChange={(event) => set("maskedChassis", event.target.value)} /></label>
    <label>Cidade<input name="municipality" value={values.municipality} onChange={(event) => set("municipality", event.target.value)} /></label><label>UF<input name="state" maxLength={2} value={values.state} onChange={(event) => set("state", event.target.value.toUpperCase())} /></label>
    <label>Quilometragem<input name="odometer" type="number" min="0" value={values.odometer} onChange={(event) => set("odometer", event.target.value)} /></label>
    <button className="primary-button" type="submit">{vehicle ? "Salvar veículo" : "Adicionar veículo"}</button>
  </form>;
}
