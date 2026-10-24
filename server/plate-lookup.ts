import { normalizePlate } from "../domain/workshop-settings";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { vehicles } from "../db/schema";

export type PlateData = { plate: string; make: string; model: string; color: string | null; manufactureYear: number | null; modelYear: number | null; fuel: string | null; engineDisplacement: string | null; power: string | null; municipality: string | null; state: string | null; maskedChassis: string | null };
export type PlateProvider = (plate: string) => Promise<unknown>;
export type PlateLookupResult = { status: "found"; provider: string; data: PlateData; snapshot: Record<string, unknown> } | { status: "unavailable"; message: string } | { status: "not_found"; message: string };

export function isPlateLookupCacheFresh(lookupAt: Date | null, now = new Date(), maxAgeMs = 24 * 60 * 60 * 1000) {
  return Boolean(lookupAt && lookupAt.getTime() >= now.getTime() - maxAgeMs);
}

export async function getCachedPlateLookup(workshopId: string, plateValue: string, now = new Date()): Promise<PlateLookupResult | null> {
  const plate = normalizePlate(plateValue);
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return null;
  const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [vehicle] = await getDatabase().select().from(vehicles).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.plateNormalized, plate), gte(vehicles.lookupAt, threshold), isNotNull(vehicles.lookupSnapshot))).orderBy(desc(vehicles.lookupAt)).limit(1);
  if (!vehicle || !isPlateLookupCacheFresh(vehicle.lookupAt, now) || !vehicle.lookupSnapshot) return null;
  return {
    status: "found",
    provider: vehicle.lookupProvider ?? "cache",
    data: { plate, make: vehicle.make, model: vehicle.model, color: vehicle.color, manufactureYear: vehicle.manufactureYear, modelYear: vehicle.modelYear, fuel: vehicle.fuel, engineDisplacement: vehicle.engineDisplacement, power: vehicle.power, municipality: vehicle.municipality, state: vehicle.state, maskedChassis: vehicle.maskedChassis },
    snapshot: vehicle.lookupSnapshot,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  for (const key of ["data", "result", "vehicle", "veiculo"]) if (source[key] && typeof source[key] === "object") return source[key] as Record<string, unknown>;
  return source;
}

function pick(source: Record<string, unknown>, keys: string[]) {
  const normalized = new Map(Object.entries(source).map(([key, value]) => [key.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, ""), value]));
  for (const key of keys) { const value = normalized.get(key.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "")); if (value !== undefined && value !== null && String(value).trim()) return String(value).trim(); }
  return null;
}

function year(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null;
}

function maskChassis(value: string | null) {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  return `${"*".repeat(Math.max(0, compact.length - 5))}${compact.slice(-5)}`;
}

export function mapPlateProviderResponse(value: unknown, plate = ""): PlateData | null {
  const source = record(value);
  const make = pick(source, ["marca", "make", "brand"]);
  const model = pick(source, ["modelo", "model", "vehicleModel"]);
  if (!make || !model) return null;
  return { plate: normalizePlate(pick(source, ["placa", "plate"]) ?? plate), make, model, color: pick(source, ["cor", "color"]), manufactureYear: year(pick(source, ["anoFabricacao", "ano_fabricacao", "manufactureYear", "yearManufacture"])), modelYear: year(pick(source, ["anoModelo", "ano_modelo", "modelYear", "yearModel", "ano"])), fuel: pick(source, ["combustivel", "fuel"]), engineDisplacement: pick(source, ["cilindrada", "engineDisplacement"]), power: pick(source, ["potencia", "power"]), municipality: pick(source, ["municipio", "cidade", "municipality", "city"]), state: pick(source, ["uf", "estado", "state"])?.toUpperCase() ?? null, maskedChassis: maskChassis(pick(source, ["chassi", "chassis"])) };
}

export async function lookupPlate(plateValue: string, provider: PlateProvider | null, providerName = "configured"): Promise<PlateLookupResult> {
  const plate = normalizePlate(plateValue);
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return { status: "not_found", message: "Informe uma placa válida." };
  if (!provider) return { status: "unavailable", message: "Consulta automática não configurada. Continue o cadastro manualmente." };
  try {
    const raw = await provider(plate);
    const data = mapPlateProviderResponse(raw, plate);
    if (!data) return { status: "not_found", message: "Não encontramos dados confiáveis para esta placa. Confira manualmente." };
    return { status: "found", provider: providerName, data, snapshot: record(raw) };
  } catch {
    return { status: "unavailable", message: "A consulta está temporariamente indisponível. Continue o cadastro manualmente." };
  }
}

export function configuredPlateProvider(env: NodeJS.ProcessEnv): { provider: PlateProvider | null; name: string } {
  const endpoint = env.PLATE_LOOKUP_API_URL?.trim();
  const token = env.PLATE_LOOKUP_API_TOKEN?.trim();
  if (!endpoint || !token) return { provider: null, name: "disabled" };
  return { name: env.PLATE_LOOKUP_PROVIDER?.trim() || "plate_api", provider: async (plate) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const url = endpoint.includes("{plate}") ? endpoint.replace("{plate}", encodeURIComponent(plate)) : `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(plate)}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal });
      if (response.status === 404) return {};
      if (!response.ok) throw new Error("provider_error");
      return await response.json();
    } finally { clearTimeout(timeout); }
  } };
}
