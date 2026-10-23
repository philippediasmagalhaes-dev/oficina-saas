import { and, eq } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction } from "../db/client";
import { inspectionDamageMarks, serviceRecords, vehicleInspections } from "../db/schema";
import { normalizeInspection, type InspectionInput } from "../domain/inspection";

export type PersistInspectionInput = InspectionInput & {
  workshopId: string;
  serviceRecordId: string;
};

export interface InspectionStore {
  replace(input: PersistInspectionInput): Promise<{ id: string }>;
}

export async function persistInspection(store: InspectionStore, input: PersistInspectionInput) {
  const normalized = normalizeInspection(input);
  return store.replace({ ...input, ...normalized });
}

export function createDrizzleInspectionStore(): InspectionStore {
  return {
    async replace(input) {
      return runDatabaseTransaction(async (tx) => {
        const [order] = await tx.select({ id: serviceRecords.id }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId))).limit(1);
        if (!order) throw new Error("Ordem de serviço não encontrada.");
        const [inspection] = await tx.insert(vehicleInspections).values({
          workshopId: input.workshopId,
          serviceRecordId: input.serviceRecordId,
          odometer: input.odometer,
          fuelLevel: input.fuelLevel,
          tireCondition: input.tireCondition,
          checklist: input.checklist,
          observations: input.observations,
        }).onConflictDoUpdate({
          target: vehicleInspections.serviceRecordId,
          set: { odometer: input.odometer, fuelLevel: input.fuelLevel, tireCondition: input.tireCondition, checklist: input.checklist, observations: input.observations, updatedAt: new Date() },
        }).returning({ id: vehicleInspections.id });
        await tx.delete(inspectionDamageMarks).where(and(eq(inspectionDamageMarks.workshopId, input.workshopId), eq(inspectionDamageMarks.inspectionId, inspection.id)));
        if (input.marks.length) await tx.insert(inspectionDamageMarks).values(input.marks.map((mark) => ({ ...mark, workshopId: input.workshopId, inspectionId: inspection.id })));
        return inspection;
      });
    },
  };
}

export async function saveInspection(input: PersistInspectionInput) {
  return persistInspection(createDrizzleInspectionStore(), input);
}

export async function getInspection(workshopId: string, serviceRecordId: string) {
  const database = getDatabase();
  const [inspection] = await database.select().from(vehicleInspections).where(and(eq(vehicleInspections.workshopId, workshopId), eq(vehicleInspections.serviceRecordId, serviceRecordId))).limit(1);
  if (!inspection) return null;
  const marks = await database.select().from(inspectionDamageMarks).where(and(eq(inspectionDamageMarks.workshopId, workshopId), eq(inspectionDamageMarks.inspectionId, inspection.id)));
  return { ...inspection, marks };
}
