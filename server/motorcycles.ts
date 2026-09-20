import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { customers, serviceRecords, vehicles } from "../db/schema";

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listMotorcycles(workshopId: string) {
  const database = getDatabase();
  const rows = await database.select({
    id: vehicles.id,
    customerId: vehicles.customerId,
    customerName: customers.name,
    plate: vehicles.plate,
    make: vehicles.make,
    model: vehicles.model,
    year: vehicles.year,
    odometer: vehicles.odometer,
  }).from(vehicles).innerJoin(customers, and(eq(customers.id, vehicles.customerId), eq(customers.workshopId, workshopId))).where(eq(vehicles.workshopId, workshopId)).orderBy(vehicles.plate);
  const history = await database.select({ vehicleId: serviceRecords.vehicleId, completedAt: serviceRecords.completedAt }).from(serviceRecords).where(eq(serviceRecords.workshopId, workshopId)).orderBy(desc(serviceRecords.completedAt));
  return rows.map((row) => {
    const services = history.filter((service) => service.vehicleId === row.id);
    return { ...row, serviceCount: services.length, lastServiceAt: services.find((service) => service.completedAt)?.completedAt ?? null };
  });
}

export async function getMotorcycle(workshopId: string, vehicleId: string) {
  if (!validUuid(vehicleId)) return null;
  const database = getDatabase();
  const [motorcycle] = await database.select({
    id: vehicles.id,
    workshopId: vehicles.workshopId,
    customerId: vehicles.customerId,
    customerName: customers.name,
    plate: vehicles.plate,
    make: vehicles.make,
    model: vehicles.model,
    year: vehicles.year,
    odometer: vehicles.odometer,
  }).from(vehicles).innerJoin(customers, and(eq(customers.id, vehicles.customerId), eq(customers.workshopId, workshopId))).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.id, vehicleId))).limit(1);
  if (!motorcycle) return null;
  const history = await database.select({
    id: serviceRecords.id,
    description: serviceRecords.description,
    complaint: serviceRecords.complaint,
    status: serviceRecords.status,
    amountCents: serviceRecords.amountCents,
    odometer: serviceRecords.odometer,
    deliveredOdometer: serviceRecords.deliveredOdometer,
    createdAt: serviceRecords.createdAt,
    completedAt: serviceRecords.completedAt,
    nextDueAt: serviceRecords.nextDueAt,
  }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.vehicleId, vehicleId))).orderBy(desc(serviceRecords.createdAt));
  return { ...motorcycle, history };
}

export async function updateMotorcycle(input: { workshopId: string; vehicleId: string; customerId: string; plate: string; make: string; model: string; year: number | null; odometer: number | null }) {
  const [customer] = await getDatabase().select({ id: customers.id }).from(customers).where(and(eq(customers.workshopId, input.workshopId), eq(customers.id, input.customerId))).limit(1);
  if (!customer) throw new Error("Cliente não encontrado.");
  const [row] = await getDatabase().update(vehicles).set({ customerId: input.customerId, plate: input.plate, make: input.make, model: input.model, year: input.year, odometer: input.odometer }).where(and(eq(vehicles.workshopId, input.workshopId), eq(vehicles.id, input.vehicleId))).returning({ id: vehicles.id });
  return row ?? null;
}
