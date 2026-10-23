import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import { inventoryItems, inventoryMovements, serviceRecords, workOrderItems } from "../db/schema";

export type InventoryOperation = { operationKey: string; quantityDelta: number; reservationDelta: number };

export interface InventoryOperationStore {
  has(operationKey: string): Promise<boolean>;
  apply(operation: InventoryOperation): Promise<void>;
}

export async function runIdempotentInventoryOperation(store: InventoryOperationStore, operation: InventoryOperation) {
  if (await store.has(operation.operationKey)) return "duplicate" as const;
  await store.apply(operation);
  return "applied" as const;
}

async function loadPartItems(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  return tx.select({ id: workOrderItems.id, inventoryItemId: workOrderItems.inventoryItemId, quantity: workOrderItems.quantity, description: workOrderItems.description }).from(workOrderItems).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.serviceRecordId, serviceRecordId), eq(workOrderItems.type, "part")));
}

async function alreadyApplied(tx: DatabaseTransaction, workshopId: string, operationKey: string) {
  const [row] = await tx.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.workshopId, workshopId), eq(inventoryMovements.operationKey, operationKey))).limit(1);
  return Boolean(row);
}

export async function reserveApprovedOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    const operationKey = `reserve:${part.id}`;
    if (await alreadyApplied(tx, workshopId, operationKey)) continue;
    const [stock] = await tx.update(inventoryItems).set({ reservedQuantity: sql`${inventoryItems.reservedQuantity} + ${part.quantity}` }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.currentQuantity} - ${inventoryItems.reservedQuantity} >= ${part.quantity}`)).returning({ id: inventoryItems.id });
    if (!stock) throw new Error(`Estoque disponível insuficiente para ${part.description}.`);
    await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId, type: "adjustment", quantityDelta: 0, reservationDelta: part.quantity, operationKey, note: "Reserva para OS" });
    await tx.update(workOrderItems).set({ reservationState: "reserved" }).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, part.id)));
  }
}

export async function consumeReservedOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    const operationKey = `consume:${part.id}`;
    if (await alreadyApplied(tx, workshopId, operationKey)) continue;
    const [stock] = await tx.update(inventoryItems).set({ currentQuantity: sql`${inventoryItems.currentQuantity} - ${part.quantity}`, reservedQuantity: sql`${inventoryItems.reservedQuantity} - ${part.quantity}` }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.currentQuantity} >= ${part.quantity}`, sql`${inventoryItems.reservedQuantity} >= ${part.quantity}`)).returning({ id: inventoryItems.id });
    if (!stock) throw new Error(`Reserva insuficiente para ${part.description}.`);
    await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId, type: "consumption", quantityDelta: -part.quantity, reservationDelta: -part.quantity, operationKey, note: "Consumo na execução da OS" });
    await tx.update(workOrderItems).set({ reservationState: "consumed", completionState: "completed" }).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, part.id)));
  }
}

export async function releaseCancelledOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    const operationKey = `release:${part.id}`;
    if (await alreadyApplied(tx, workshopId, operationKey)) continue;
    const [stock] = await tx.update(inventoryItems).set({ reservedQuantity: sql`${inventoryItems.reservedQuantity} - ${part.quantity}` }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.reservedQuantity} >= ${part.quantity}`)).returning({ id: inventoryItems.id });
    if (!stock) continue;
    await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId, type: "adjustment", quantityDelta: 0, reservationDelta: -part.quantity, operationKey, note: "Liberação por cancelamento da OS" });
    await tx.update(workOrderItems).set({ reservationState: "released" }).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, part.id)));
  }
}

export function reserveApprovedOrderStock(workshopId: string, serviceRecordId: string) {
  return runDatabaseTransaction((tx) => reserveApprovedOrderStockTx(tx, workshopId, serviceRecordId));
}

export function consumeReservedOrderStock(workshopId: string, serviceRecordId: string) {
  return runDatabaseTransaction((tx) => consumeReservedOrderStockTx(tx, workshopId, serviceRecordId));
}

export function releaseCancelledOrderStock(workshopId: string, serviceRecordId: string) {
  return runDatabaseTransaction((tx) => releaseCancelledOrderStockTx(tx, workshopId, serviceRecordId));
}

export async function listInventoryMovements(workshopId: string) {
  return getDatabase().select({ id: inventoryMovements.id, itemName: inventoryItems.name, orderNumber: serviceRecords.orderNumber, type: inventoryMovements.type, quantityDelta: inventoryMovements.quantityDelta, reservationDelta: inventoryMovements.reservationDelta, note: inventoryMovements.note, createdAt: inventoryMovements.createdAt }).from(inventoryMovements).innerJoin(inventoryItems, and(eq(inventoryItems.id, inventoryMovements.inventoryItemId), eq(inventoryItems.workshopId, workshopId))).leftJoin(serviceRecords, and(eq(serviceRecords.id, inventoryMovements.serviceRecordId), eq(serviceRecords.workshopId, workshopId))).where(eq(inventoryMovements.workshopId, workshopId)).orderBy(desc(inventoryMovements.createdAt)).limit(50);
}
