import { normalizePlate } from "../domain/workshop-settings";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { vehicles } from "../db/schema";

export type PlateData = { plate: string; make: string; model: string; color: string | null; manufactureYear: number | null; modelYear: number | null; fuel: string | null; engineDisplacement: string | null; power: string | null; municipality: string | null; state: string | null; maskedChassis: string | null };
export type PlateProviderResponse = { payload: unknown; balanceCents: number | null };
export type PlateProvider = (plate: string) => Promise<unknown | PlateProviderResponse>;
export type PlateLookupResult = { status: "found"; provider: string; data: PlateData; snapshot: Record<string, unknown>; balanceCents: number | null; cached: boolean } | { status: "unavailable"; message: string } | { status: "not_found"; message: string };

const PLATE_LOOKUP_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export function plateLookupCacheControl(result: PlateLookupResult) {
  return result.status === "found"
    ? "private, max-age=3600"
    : "private, no-store";
}

export class PlateProviderError extends Error {
  constructor(readonly code: string) {
    super("plate_provider_error");
  }
}

export function isPlateLookupCacheFresh(lookupAt: Date | null, now = new Date(), maxAgeMs = PLATE_LOOKUP_CACHE_MS) {
  return Boolean(lookupAt && lookupAt.getTime() >= now.getTime() - maxAgeMs);
}

export async function getCachedPlateLookup(workshopId: string, plateValue: string, now = new Date()): Promise<PlateLookupResult | null> {
  const plate = normalizePlate(plateValue);
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return null;
  const threshold = new Date(now.getTime() - PLATE_LOOKUP_CACHE_MS);
  const [vehicle] = await getDatabase().select().from(vehicles).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.plateNormalized, plate), gte(vehicles.lookupAt, threshold), isNotNull(vehicles.lookupSnapshot))).orderBy(desc(vehicles.lookupAt)).limit(1);
  if (!vehicle || !isPlateLookupCacheFresh(vehicle.lookupAt, now) || !vehicle.lookupSnapshot) return null;
  return {
    status: "found",
    provider: vehicle.lookupProvider ?? "cache",
    data: { plate, make: vehicle.make, model: vehicle.model, color: vehicle.color, manufactureYear: vehicle.manufactureYear, modelYear: vehicle.modelYear, fuel: vehicle.fuel, engineDisplacement: vehicle.engineDisplacement, power: vehicle.power, municipality: vehicle.municipality, state: vehicle.state, maskedChassis: vehicle.maskedChassis },
    snapshot: vehicle.lookupSnapshot,
    balanceCents: null,
    cached: true,
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
  const visibleSuffix = compact.match(/[^*]{1,5}$/)?.[0] ?? "";
  return `${"*".repeat(Math.max(0, compact.length - visibleSuffix.length))}${visibleSuffix}`;
}

function withUnit(value: string | null, unit: string) {
  if (!value) return null;
  return /^\d+(?:[.,]\d+)?$/.test(value) ? `${value} ${unit}` : value;
}

export function mapPlateProviderResponse(value: unknown, plate = ""): PlateData | null {
  const source = record(value);
  const make = pick(source, ["marca", "make", "brand"]);
  const model = pick(source, ["modelo", "model", "vehicleModel"]);
  if (!make || !model) return null;
  const fipeDisplacement = pick(source, ["cilindradas"]);
  return { plate: normalizePlate(pick(source, ["placa", "plate"]) ?? plate), make, model, color: pick(source, ["cor", "color"]), manufactureYear: year(pick(source, ["anoFabricacao", "ano_fabricacao", "manufactureYear", "yearManufacture"])), modelYear: year(pick(source, ["anoModelo", "ano_modelo", "modelYear", "yearModel", "ano"])), fuel: pick(source, ["combustivel", "fuel"]), engineDisplacement: fipeDisplacement ? withUnit(fipeDisplacement, "cc") : pick(source, ["cilindrada", "engineDisplacement"]), power: withUnit(pick(source, ["potencia", "power"]), "cv"), municipality: pick(source, ["municipio", "cidade", "municipality", "city"]), state: pick(source, ["uf", "estado", "state"])?.toUpperCase() ?? null, maskedChassis: maskChassis(pick(source, ["chassi", "chassis"])) };
}

function unwrapProviderResponse(value: unknown): PlateProviderResponse {
  if (value && typeof value === "object" && "payload" in value) {
    const response = value as Partial<PlateProviderResponse>;
    return {
      payload: response.payload,
      balanceCents: Number.isInteger(response.balanceCents) ? response.balanceCents! : null,
    };
  }
  return { payload: value, balanceCents: null };
}

function safeProviderFailure(error: unknown): PlateLookupResult {
  if (!(error instanceof PlateProviderError))
    return { status: "unavailable", message: "A consulta está temporariamente indisponível. Continue o cadastro manualmente." };
  if (error.code === "PLACA_NAO_ENCONTRADA")
    return { status: "not_found", message: "A placa não foi encontrada. Confira o número e preencha manualmente." };
  if (error.code === "SEM_SALDO")
    return { status: "unavailable", message: "Saldo da consulta por placa esgotado. Continue manualmente até a recarga." };
  if (error.code === "CHAVE_INVALIDA")
    return { status: "unavailable", message: "A consulta por placa precisa de configuração. Continue o cadastro manualmente." };
  return { status: "unavailable", message: "A consulta está temporariamente indisponível. Continue o cadastro manualmente." };
}

export async function lookupPlate(plateValue: string, provider: PlateProvider | null, providerName = "configured"): Promise<PlateLookupResult> {
  const plate = normalizePlate(plateValue);
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return { status: "not_found", message: "Informe uma placa válida." };
  if (!provider) return { status: "unavailable", message: "Consulta automática não configurada. Continue o cadastro manualmente." };
  try {
    const response = unwrapProviderResponse(await provider(plate));
    const data = mapPlateProviderResponse(response.payload, plate);
    if (!data) return { status: "not_found", message: "Não encontramos dados confiáveis para esta placa. Confira manualmente." };
    return { status: "found", provider: providerName, data, snapshot: record(response.payload), balanceCents: response.balanceCents, cached: false };
  } catch (error) {
    return safeProviderFailure(error);
  }
}

async function providerErrorCode(response: Response) {
  try {
    const body = await response.json() as { erro?: { codigo?: unknown } };
    return typeof body.erro?.codigo === "string" ? body.erro.codigo : `HTTP_${response.status}`;
  } catch {
    return `HTTP_${response.status}`;
  }
}

export function configuredPlateProvider(env: NodeJS.ProcessEnv, fetcher: typeof fetch = fetch): { provider: PlateProvider | null; name: string } {
  const name = env.PLATE_LOOKUP_PROVIDER?.trim().toLocaleLowerCase("pt-BR") || "plate_api";
  const endpoint = env.PLATE_LOOKUP_API_URL?.trim() || (name === "fipeplaca" ? "https://api.fipeplaca.com.br/gateway/v1/placa/{plate}" : "");
  const token = env.PLATE_LOOKUP_API_TOKEN?.trim();
  if (!endpoint || !token) return { provider: null, name: "disabled" };
  return { name, provider: async (plate) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const url = endpoint.includes("{plate}") ? endpoint.replace("{plate}", encodeURIComponent(plate)) : `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(plate)}`;
      const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new PlateProviderError(await providerErrorCode(response));
      const balance = response.headers.get("X-Saldo-Centavos");
      const balanceCents = balance && /^\d+$/.test(balance) ? Number.parseInt(balance, 10) : null;
      return { payload: await response.json(), balanceCents };
    } finally { clearTimeout(timeout); }
  } };
}
