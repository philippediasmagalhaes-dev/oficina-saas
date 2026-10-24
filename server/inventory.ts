import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import { inventoryItems, inventoryMovements, serviceRecords, workOrderItems } from "../db/schema";
import { inventoryOperationKey, shouldConsumeReservation, shouldReleaseReservation } from "../domain/inventory";

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
  return tx.select({ id: workOrderItems.id, inventoryItemId: workOrderItems.inventoryItemId, quantity: workOrderItems.quantity, description: workOrderItems.description, reservationState: workOrderItems.reservationState }).from(workOrderItems).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.serviceRecordId, serviceRecordId), eq(workOrderItems.type, "part")));
}

async function quoteVersion(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const [order] = await tx.select({ quoteVersion: serviceRecords.quoteVersion }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId))).limit(1);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  return order.quoteVersion;
}

async function alreadyApplied(tx: DatabaseTransaction, workshopId: string, operationKey: string) {
  const [row] = await tx.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.workshopId, workshopId), eq(inventoryMovements.operationKey, operationKey))).limit(1);
  return Boolean(row);
}

export async function reserveApprovedOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const version = await quoteVersion(tx, workshopId, serviceRecordId);
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    if (part.reservationState === "reserved" || part.reservationState === "consumed") continue;
    const operationKey = inventoryOperationKey("reserve", part.id, version);
    if (await alreadyApplied(tx, workshopId, operationKey)) continue;
    const [stock] = await tx.update(inventoryItems).set({ reservedQuantity: sql`${inventoryItems.reservedQuantity} + ${part.quantity}` }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.currentQuantity} - ${inventoryItems.reservedQuantity} >= ${part.quantity}`)).returning({ id: inventoryItems.id });
    if (!stock) throw new Error(`Estoque disponível insuficiente para ${part.description}.`);
    await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId, type: "adjustment", quantityDelta: 0, reservationDelta: part.quantity, operationKey, note: "Reserva para OS" });
    await tx.update(workOrderItems).set({ reservationState: "reserved" }).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, part.id)));
  }
}

export async function consumeReservedOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const version = await quoteVersion(tx, workshopId, serviceRecordId);
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    if (part.reservationState === "consumed") continue;
    const operationKey = inventoryOperationKey("consume", part.id, version);
    if (await alreadyApplied(tx, workshopId, operationKey)) continue;
    const consumesReservation = shouldConsumeReservation(part.reservationState);
    const [stock] = await tx.update(inventoryItems).set({ currentQuantity: sql`${inventoryItems.currentQuantity} - ${part.quantity}`, ...(consumesReservation ? { reservedQuantity: sql`${inventoryItems.reservedQuantity} - ${part.quantity}` } : {}) }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.currentQuantity} >= ${part.quantity}`, consumesReservation ? sql`${inventoryItems.reservedQuantity} >= ${part.quantity}` : undefined)).returning({ id: inventoryItems.id });
    if (!stock) throw new Error(`${consumesReservation ? "Reserva" : "Estoque"} insuficiente para ${part.description}.`);
    await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId, type: "consumption", quantityDelta: -part.quantity, reservationDelta: consumesReservation ? -part.quantity : 0, operationKey, note: consumesReservation ? "Consumo na execução da OS" : "Consumo reconciliado de OS existente" });
    await tx.update(workOrderItems).set({ reservationState: "consumed", completionState: "completed" }).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, part.id)));
  }
}

export async function releaseCancelledOrderStockTx(tx: DatabaseTransaction, workshopId: string, serviceRecordId: string) {
  const version = await quoteVersion(tx, workshopId, serviceRecordId);
  const parts = await loadPartItems(tx, workshopId, serviceRecordId);
  for (const part of parts) {
    if (!part.inventoryItemId) continue;
    if (!shouldReleaseReservation(part.reservationState)) continue;
    const operationKey = inventoryOperationKey("release", part.id, version);
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
