import { and, eq } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { serviceCatalogItems } from "../db/schema";

// Starting intervals are editable workshop recommendations, not manufacturer schedules.
export const AUTOMOTIVE_SERVICES = [
  { name: "Troca de óleo e filtro", days: 180, km: 5000 },
  { name: "Revisão preventiva", days: 180, km: 10000 },
  { name: "Alinhamento e balanceamento", days: 180, km: 10000 },
  { name: "Rodízio de pneus", days: 180, km: 10000 },
  { name: "Inspeção de freios", days: 180, km: 10000 },
  { name: "Troca de filtro de ar", days: 365, km: 10000 },
  { name: "Troca de filtro de cabine", days: 365, km: 15000 },
  { name: "Troca de fluido de freio", days: 730, km: null },
  { name: "Revisão do arrefecimento", days: 365, km: 20000 },
  { name: "Diagnóstico eletrônico", days: null, km: null },
  { name: "Revisão de suspensão", days: 365, km: 20000 },
  { name: "Inspeção de correias", days: 365, km: 20000 },
] as const;

export async function seedAutomotiveCatalog(workshopId: string) {
  await getDatabase().insert(serviceCatalogItems).values(AUTOMOTIVE_SERVICES.map((item) => ({
    workshopId, name: item.name, defaultPriceCents: 0,
    defaultReturnIntervalDays: item.days, defaultReturnIntervalKm: item.km,
  }))).onConflictDoNothing();
}

export async function updateCatalogMaintenance(input: {
  workshopId: string; id: string; days: number | null; km: number | null; priceCents: number;
}) {
  const rows = await getDatabase().update(serviceCatalogItems).set({
    defaultReturnIntervalDays: input.days, defaultReturnIntervalKm: input.km,
    defaultPriceCents: input.priceCents, updatedAt: new Date(),
  }).where(and(eq(serviceCatalogItems.workshopId, input.workshopId), eq(serviceCatalogItems.id, input.id))).returning({ id: serviceCatalogItems.id });
  if (!rows.length) throw new Error("Serviço não encontrado.");
}
