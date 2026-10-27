import { and, count, desc, eq, ilike, inArray, max, or, sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { customers, serviceRecords, vehicles } from "../db/schema";
import {
  buildPageWindow,
  escapeLikePattern,
  type PagedResult,
} from "../domain/pagination";
import { normalizePlate } from "../domain/workshop-settings";

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listVehicles(workshopId: string) {
  const database = getDatabase();
  const rows = await database.select({
    id: vehicles.id,
    customerId: vehicles.customerId,
    customerName: customers.name,
    plate: vehicles.plate,
    plateNormalized: vehicles.plateNormalized,
    make: vehicles.make,
    model: vehicles.model,
    year: vehicles.year,
    category: vehicles.category,
    color: vehicles.color,
    manufactureYear: vehicles.manufactureYear,
    modelYear: vehicles.modelYear,
    fuel: vehicles.fuel,
    engineDisplacement: vehicles.engineDisplacement,
    power: vehicles.power,
    municipality: vehicles.municipality,
    state: vehicles.state,
    maskedChassis: vehicles.maskedChassis,
    lookupProvider: vehicles.lookupProvider,
    lookupAt: vehicles.lookupAt,
    lookupSnapshot: vehicles.lookupSnapshot,
    odometer: vehicles.odometer,
  }).from(vehicles).innerJoin(customers, and(eq(customers.id, vehicles.customerId), eq(customers.workshopId, workshopId))).where(eq(vehicles.workshopId, workshopId)).orderBy(vehicles.plate);
  const history = await database
    .select({ vehicleId: serviceRecords.vehicleId, serviceCount: count(), lastServiceAt: max(serviceRecords.completedAt) })
    .from(serviceRecords)
    .where(eq(serviceRecords.workshopId, workshopId))
    .groupBy(serviceRecords.vehicleId);
  const historyByVehicle = new Map(history.map((service) => [service.vehicleId, service]));
  return rows.map((row) => ({
    ...row,
    serviceCount: Number(historyByVehicle.get(row.id)?.serviceCount ?? 0),
    lastServiceAt: historyByVehicle.get(row.id)?.lastServiceAt ?? null,
  }));
}

export type VehicleListItem = Awaited<ReturnType<typeof listVehicles>>[number];

export async function listVehiclesPage(
  workshopId: string,
  input: { query: string; page: number; pageSize: number },
): Promise<PagedResult<VehicleListItem>> {
  const database = getDatabase();
  const query = input.query.trim();
  const pattern = `%${escapeLikePattern(query)}%`;
  const filter = and(
    eq(vehicles.workshopId, workshopId),
    query
      ? or(
          ilike(vehicles.plate, pattern),
          ilike(vehicles.make, pattern),
          ilike(vehicles.model, pattern),
          ilike(customers.name, pattern),
        )
      : undefined,
  );
  const [{ total: rawTotal }] = await database
    .select({ total: count() })
    .from(vehicles)
    .innerJoin(
      customers,
      and(
        eq(customers.id, vehicles.customerId),
        eq(customers.workshopId, workshopId),
      ),
    )
    .where(filter);
  const window = buildPageWindow({
    total: Number(rawTotal),
    page: input.page,
    pageSize: input.pageSize,
  });
  const rows = await database
    .select({
      id: vehicles.id,
      workshopId: vehicles.workshopId,
      customerId: vehicles.customerId,
      customerName: customers.name,
      plate: vehicles.plate,
      plateNormalized: vehicles.plateNormalized,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      category: vehicles.category,
      color: vehicles.color,
      manufactureYear: vehicles.manufactureYear,
      modelYear: vehicles.modelYear,
      fuel: vehicles.fuel,
      engineDisplacement: vehicles.engineDisplacement,
      power: vehicles.power,
      municipality: vehicles.municipality,
      state: vehicles.state,
      maskedChassis: vehicles.maskedChassis,
      lookupProvider: vehicles.lookupProvider,
      lookupAt: vehicles.lookupAt,
      lookupSnapshot: vehicles.lookupSnapshot,
      odometer: vehicles.odometer,
    })
    .from(vehicles)
    .innerJoin(
      customers,
      and(
        eq(customers.id, vehicles.customerId),
        eq(customers.workshopId, workshopId),
      ),
    )
    .where(filter)
    .orderBy(vehicles.plate)
    .limit(window.pageSize)
    .offset(window.offset);
  if (!rows.length) return { ...window, items: [] };
  const history = await database
    .select({
      vehicleId: serviceRecords.vehicleId,
      serviceCount: count(),
      lastServiceAt: max(serviceRecords.completedAt),
    })
    .from(serviceRecords)
    .where(
      and(
        eq(serviceRecords.workshopId, workshopId),
        inArray(serviceRecords.vehicleId, rows.map((row) => row.id)),
      ),
    )
    .groupBy(serviceRecords.vehicleId);
  const historyByVehicle = new Map(history.map((service) => [service.vehicleId, service]));
  return {
    ...window,
    items: rows.map((row) => ({
      ...row,
      serviceCount: Number(historyByVehicle.get(row.id)?.serviceCount ?? 0),
      lastServiceAt: historyByVehicle.get(row.id)?.lastServiceAt ?? null,
    })),
  };
}

export async function getVehicle(workshopId: string, vehicleId: string) {
  if (!validUuid(vehicleId)) return null;
  const database = getDatabase();
  const [vehicle] = await database.select({
    id: vehicles.id,
    workshopId: vehicles.workshopId,
    customerId: vehicles.customerId,
    customerName: customers.name,
    plate: vehicles.plate,
    plateNormalized: vehicles.plateNormalized,
    make: vehicles.make,
    model: vehicles.model,
    year: vehicles.year,
    category: vehicles.category,
    color: vehicles.color,
    manufactureYear: vehicles.manufactureYear,
    modelYear: vehicles.modelYear,
    fuel: vehicles.fuel,
    engineDisplacement: vehicles.engineDisplacement,
    power: vehicles.power,
    municipality: vehicles.municipality,
    state: vehicles.state,
    maskedChassis: vehicles.maskedChassis,
    lookupProvider: vehicles.lookupProvider,
    lookupAt: vehicles.lookupAt,
    lookupSnapshot: vehicles.lookupSnapshot,
    odometer: vehicles.odometer,
  }).from(vehicles).innerJoin(customers, and(eq(customers.id, vehicles.customerId), eq(customers.workshopId, workshopId))).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.id, vehicleId))).limit(1);
  if (!vehicle) return null;
  const history = await database.select({
    id: serviceRecords.id,
    description: serviceRecords.description,
    complaint: serviceRecords.complaint,
    status: serviceRecords.status,
    amountCents: serviceRecords.amountCents,
    odometer: serviceRecords.odometer,
    deliveredOdometer: serviceRecords.deliveredOdometer,
    intakeAt: serviceRecords.intakeAt,
    createdAt: serviceRecords.createdAt,
    completedAt: serviceRecords.completedAt,
    nextDueAt: serviceRecords.nextDueAt,
  }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.vehicleId, vehicleId))).orderBy(desc(serviceRecords.intakeAt), desc(serviceRecords.createdAt));
  return { ...vehicle, history };
}

export async function updateVehicle(input: { workshopId: string; vehicleId: string; customerId: string; plate: string; make: string; model: string; year: number | null; category: string; color: string | null; manufactureYear: number | null; modelYear: number | null; fuel: string | null; engineDisplacement: string | null; power: string | null; municipality: string | null; state: string | null; maskedChassis: string | null; lookupProvider: string | null; lookupAt: Date | null; lookupSnapshot: Record<string, unknown> | null; odometer: number | null }) {
  const [customer] = await getDatabase().select({ id: customers.id }).from(customers).where(and(eq(customers.workshopId, input.workshopId), eq(customers.id, input.customerId))).limit(1);
  if (!customer) throw new Error("Cliente não encontrado.");
  const plate = normalizePlate(input.plate);
  const [row] = await getDatabase().update(vehicles).set({ customerId: input.customerId, plate, plateNormalized: plate, make: input.make, model: input.model, year: input.year, category: input.category, color: input.color, manufactureYear: input.manufactureYear, modelYear: input.modelYear, fuel: input.fuel, engineDisplacement: input.engineDisplacement, power: input.power, municipality: input.municipality, state: input.state, maskedChassis: input.maskedChassis, lookupProvider: input.lookupProvider, lookupAt: input.lookupAt, lookupSnapshot: input.lookupSnapshot, odometer: input.odometer }).where(and(eq(vehicles.workshopId, input.workshopId), eq(vehicles.id, input.vehicleId))).returning({ id: vehicles.id });
  return row ?? null;
}
