import { sql } from "drizzle-orm";
import { workshopSequences } from "../db/schema";
import type { DatabaseTransaction } from "../db/client";

export interface WorkOrderSequenceStore {
  allocate(workshopId: string): Promise<number>;
}

export async function nextWorkOrderNumber(store: WorkOrderSequenceStore, workshopId: string) {
  const value = await store.allocate(workshopId);
  if (!Number.isInteger(value) || value < 1) throw new Error("Número de OS inválido.");
  return value;
}

export function createDrizzleSequenceStore(transaction: Pick<DatabaseTransaction, "insert">): WorkOrderSequenceStore {
  return {
    async allocate(workshopId) {
      const [row] = await transaction
        .insert(workshopSequences)
        .values({ workshopId, nextWorkOrderNumber: 2 })
        .onConflictDoUpdate({
          target: workshopSequences.workshopId,
          set: {
            nextWorkOrderNumber: sql`${workshopSequences.nextWorkOrderNumber} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ number: sql<number>`${workshopSequences.nextWorkOrderNumber} - 1` });
      return Number(row.number);
    },
  };
}
