import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import {
  customers,
  inventoryItems,
  inventoryMovements,
  serviceCatalogItems,
  servicePhotos,
  serviceRecords,
  vehicles,
  workOrderItems,
  workshops,
} from "../db/schema";
import { calculateQuoteTotal, type WorkOrderStatus } from "../domain/work-orders";

export type WorkOrderItemSummary = {
  id: string;
  type: "service" | "part";
  description: string;
  quantity: number;
  unitPriceCents: number;
  serviceCatalogId: string | null;
  inventoryItemId: string | null;
};

export type WorkOrderPhotoSummary = {
  id: string;
  kind: "intake" | "diagnosis" | "completion";
  caption: string | null;
  fileName: string;
  uploadedAt: Date;
};

export type WorkOrderSummary = {
  id: string;
  customerId: string;
  customerName: string;
  vehicleId: string | null;
  vehicleLabel: string | null;
  complaint: string | null;
  description: string;
  status: WorkOrderStatus;
  quoteStatus: "draft" | "sent" | "approved" | "rejected";
  amountCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkOrderDetails = WorkOrderSummary & {
  workshopId: string;
  workshopName: string;
  customerPhone: string | null;
  customerWhatsappConsent: boolean;
  diagnosis: string | null;
  notes: string | null;
  odometer: number | null;
  completedAt: Date | null;
  nextDueAt: Date | null;
  returnIntervalDays: number | null;
  quoteToken: string;
  quoteDiscountCents: number;
  quoteValidUntil: Date | null;
  quoteRespondedAt: Date | null;
  approvedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  paymentMethod: string | null;
  paymentStatus: string;
  warrantyDays: number | null;
  deliveredOdometer: number | null;
  items: WorkOrderItemSummary[];
  photos: WorkOrderPhotoSummary[];
  subtotalCents: number;
};

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function vehicleLabelSql() {
  return sql<string | null>`case when ${vehicles.id} is null then null else concat(${vehicles.make}, ' ', ${vehicles.model}, ' · ', ${vehicles.plate}) end`;
}

export async function listWorkOrders(workshopId: string): Promise<WorkOrderSummary[]> {
  const database = getDatabase();
  return database
    .select({
      id: serviceRecords.id,
      customerId: serviceRecords.customerId,
      customerName: customers.name,
      vehicleId: serviceRecords.vehicleId,
      vehicleLabel: vehicleLabelSql(),
      complaint: serviceRecords.complaint,
      description: serviceRecords.description,
      status: serviceRecords.status,
      quoteStatus: serviceRecords.quoteStatus,
      amountCents: serviceRecords.amountCents,
      createdAt: serviceRecords.createdAt,
      updatedAt: serviceRecords.updatedAt,
    })
    .from(serviceRecords)
    .innerJoin(customers, and(eq(customers.id, serviceRecords.customerId), eq(customers.workshopId, workshopId)))
    .leftJoin(vehicles, and(eq(vehicles.id, serviceRecords.vehicleId), eq(vehicles.workshopId, workshopId)))
    .where(eq(serviceRecords.workshopId, workshopId))
    .orderBy(desc(serviceRecords.updatedAt));
}

export async function createWorkOrder(input: {
  workshopId: string;
  customerId: string;
  vehicleId: string;
  complaint: string;
  odometer: number | null;
  notes: string | null;
}) {
  const database = getDatabase();
  const [customer] = await database.select({ id: customers.id }).from(customers).where(and(eq(customers.workshopId, input.workshopId), eq(customers.id, input.customerId))).limit(1);
  const [vehicle] = await database.select({ id: vehicles.id, customerId: vehicles.customerId }).from(vehicles).where(and(eq(vehicles.workshopId, input.workshopId), eq(vehicles.id, input.vehicleId))).limit(1);
  if (!customer || !vehicle || vehicle.customerId !== customer.id) throw new Error("Cliente ou moto não encontrados.");
  const [order] = await database.insert(serviceRecords).values({
    workshopId: input.workshopId,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    serviceCatalogId: null,
    description: input.complaint.slice(0, 120),
    complaint: input.complaint,
    status: "open",
    amountCents: 0,
    completedAt: null,
    odometer: input.odometer,
    notes: input.notes,
  }).returning({ id: serviceRecords.id });
  return order;
}

async function loadItems(workshopId: string, serviceRecordId: string) {
  return getDatabase().select({
    id: workOrderItems.id,
    type: workOrderItems.type,
    description: workOrderItems.description,
    quantity: workOrderItems.quantity,
    unitPriceCents: workOrderItems.unitPriceCents,
    serviceCatalogId: workOrderItems.serviceCatalogId,
    inventoryItemId: workOrderItems.inventoryItemId,
  }).from(workOrderItems).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.serviceRecordId, serviceRecordId))).orderBy(workOrderItems.createdAt);
}

export async function getWorkOrder(workshopId: string, serviceRecordId: string): Promise<WorkOrderDetails | null> {
  if (!validUuid(serviceRecordId)) return null;
  const database = getDatabase();
  const [order] = await database.select({
    id: serviceRecords.id,
    workshopId: serviceRecords.workshopId,
    workshopName: workshops.name,
    customerId: serviceRecords.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    customerWhatsappConsent: customers.whatsappConsent,
    vehicleId: serviceRecords.vehicleId,
    vehicleLabel: vehicleLabelSql(),
    complaint: serviceRecords.complaint,
    description: serviceRecords.description,
    status: serviceRecords.status,
    quoteStatus: serviceRecords.quoteStatus,
    amountCents: serviceRecords.amountCents,
    diagnosis: serviceRecords.diagnosis,
    notes: serviceRecords.notes,
    odometer: serviceRecords.odometer,
    completedAt: serviceRecords.completedAt,
    nextDueAt: serviceRecords.nextDueAt,
    returnIntervalDays: serviceRecords.returnIntervalDays,
    quoteToken: serviceRecords.quoteToken,
    quoteDiscountCents: serviceRecords.quoteDiscountCents,
    quoteValidUntil: serviceRecords.quoteValidUntil,
    quoteRespondedAt: serviceRecords.quoteRespondedAt,
    approvedAt: serviceRecords.approvedAt,
    readyAt: serviceRecords.readyAt,
    deliveredAt: serviceRecords.deliveredAt,
    paymentMethod: serviceRecords.paymentMethod,
    paymentStatus: serviceRecords.paymentStatus,
    warrantyDays: serviceRecords.warrantyDays,
    deliveredOdometer: serviceRecords.deliveredOdometer,
    createdAt: serviceRecords.createdAt,
    updatedAt: serviceRecords.updatedAt,
  }).from(serviceRecords)
    .innerJoin(workshops, eq(workshops.id, serviceRecords.workshopId))
    .innerJoin(customers, and(eq(customers.id, serviceRecords.customerId), eq(customers.workshopId, workshopId)))
    .leftJoin(vehicles, and(eq(vehicles.id, serviceRecords.vehicleId), eq(vehicles.workshopId, workshopId)))
    .where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId))).limit(1);
  if (!order) return null;
  const [items, photos] = await Promise.all([
    loadItems(workshopId, serviceRecordId),
    database.select({ id: servicePhotos.id, kind: servicePhotos.kind, caption: servicePhotos.caption, fileName: servicePhotos.fileName, uploadedAt: servicePhotos.uploadedAt }).from(servicePhotos).where(and(eq(servicePhotos.workshopId, workshopId), eq(servicePhotos.serviceRecordId, serviceRecordId))).orderBy(desc(servicePhotos.uploadedAt)),
  ]);
  const totals = calculateQuoteTotal(items, order.quoteDiscountCents);
  return { ...order, items, photos, subtotalCents: totals.subtotalCents };
}

export async function saveDiagnosis(input: { workshopId: string; serviceRecordId: string; complaint: string; diagnosis: string; notes: string | null }) {
  const [row] = await getDatabase().update(serviceRecords).set({ complaint: input.complaint, diagnosis: input.diagnosis, notes: input.notes, description: input.complaint.slice(0, 120), status: "diagnosis", quoteStatus: "draft" }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), inArray(serviceRecords.status, ["open", "diagnosis", "awaiting_approval"]))).returning({ id: serviceRecords.id });
  if (!row) throw new Error("Ordem de serviço não encontrada ou já finalizada.");
}

async function recalculateWorkOrder(workshopId: string, serviceRecordId: string) {
  const database = getDatabase();
  const items = await loadItems(workshopId, serviceRecordId);
  const [order] = await database.select({ discount: serviceRecords.quoteDiscountCents }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId))).limit(1);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  const totals = calculateQuoteTotal(items, order.discount);
  await database.update(serviceRecords).set({ amountCents: totals.totalCents }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId)));
  return totals;
}

export async function addQuoteItem(input: {
  workshopId: string;
  serviceRecordId: string;
  type: "service" | "part";
  referenceId: string;
  quantity: number;
  unitPriceCents: number;
}) {
  const database = getDatabase();
  const [order] = await database.select({ id: serviceRecords.id }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), inArray(serviceRecords.status, ["open", "diagnosis"]))).limit(1);
  if (!order) throw new Error("A ordem não permite alterar o orçamento neste status.");
  let description = "";
  let serviceCatalogId: string | null = null;
  let inventoryItemId: string | null = null;
  if (input.type === "service") {
    const [item] = await database.select().from(serviceCatalogItems).where(and(eq(serviceCatalogItems.workshopId, input.workshopId), eq(serviceCatalogItems.id, input.referenceId))).limit(1);
    if (!item) throw new Error("Serviço não encontrado.");
    description = item.name;
    serviceCatalogId = item.id;
  } else {
    const [item] = await database.select().from(inventoryItems).where(and(eq(inventoryItems.workshopId, input.workshopId), eq(inventoryItems.id, input.referenceId))).limit(1);
    if (!item) throw new Error("Item de estoque não encontrado.");
    description = item.name;
    inventoryItemId = item.id;
  }
  await database.insert(workOrderItems).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, type: input.type, serviceCatalogId, inventoryItemId, description, quantity: input.quantity, unitPriceCents: input.unitPriceCents });
  await recalculateWorkOrder(input.workshopId, input.serviceRecordId);
}

export async function removeQuoteItem(workshopId: string, serviceRecordId: string, itemId: string) {
  await getDatabase().delete(workOrderItems).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.serviceRecordId, serviceRecordId), eq(workOrderItems.id, itemId)));
  await recalculateWorkOrder(workshopId, serviceRecordId);
}

export async function sendQuote(input: { workshopId: string; serviceRecordId: string; discountCents: number; validUntil: Date | null }) {
  const database = getDatabase();
  const [editableOrder] = await database.select({ id: serviceRecords.id, diagnosis: serviceRecords.diagnosis }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), eq(serviceRecords.status, "diagnosis"))).limit(1);
  if (!editableOrder?.diagnosis) throw new Error("Salve o diagnóstico antes de publicar o orçamento.");
  await database.update(serviceRecords).set({ quoteDiscountCents: input.discountCents, quoteValidUntil: input.validUntil }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
  const totals = await recalculateWorkOrder(input.workshopId, input.serviceRecordId);
  if (totals.subtotalCents <= 0) throw new Error("Adicione pelo menos um item ao orçamento.");
  const [published] = await database.update(serviceRecords).set({ quoteDiscountCents: totals.discountCents, amountCents: totals.totalCents, quoteStatus: "sent", status: "awaiting_approval" }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), eq(serviceRecords.status, "diagnosis"))).returning({ id: serviceRecords.id });
  if (!published) throw new Error("Não foi possível publicar o orçamento.");
}

export async function respondToQuote(token: string, response: "approved" | "rejected") {
  if (!validUuid(token)) return null;
  const now = new Date();
  const [row] = await getDatabase().update(serviceRecords).set({ quoteStatus: response, status: response === "approved" ? "approved" : "diagnosis", quoteRespondedAt: now, approvedAt: response === "approved" ? now : null }).where(and(eq(serviceRecords.quoteToken, token), eq(serviceRecords.quoteStatus, "sent"), eq(serviceRecords.status, "awaiting_approval"), or(isNull(serviceRecords.quoteValidUntil), gte(serviceRecords.quoteValidUntil, now)))).returning({ id: serviceRecords.id });
  return row ?? null;
}

export async function getPublicQuote(token: string) {
  if (!validUuid(token)) return null;
  const database = getDatabase();
  const [order] = await database.select({ id: serviceRecords.id, workshopId: serviceRecords.workshopId, quoteToken: serviceRecords.quoteToken, quoteStatus: serviceRecords.quoteStatus, quoteValidUntil: serviceRecords.quoteValidUntil, quoteRespondedAt: serviceRecords.quoteRespondedAt, complaint: serviceRecords.complaint, diagnosis: serviceRecords.diagnosis, amountCents: serviceRecords.amountCents, quoteDiscountCents: serviceRecords.quoteDiscountCents, workshopName: workshops.name, customerName: customers.name, vehicleLabel: vehicleLabelSql() }).from(serviceRecords).innerJoin(workshops, eq(workshops.id, serviceRecords.workshopId)).innerJoin(customers, eq(customers.id, serviceRecords.customerId)).leftJoin(vehicles, eq(vehicles.id, serviceRecords.vehicleId)).where(eq(serviceRecords.quoteToken, token)).limit(1);
  if (!order) return null;
  const items = await loadItems(order.workshopId, order.id);
  return { ...order, items, subtotalCents: items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0) };
}

export async function updateWorkOrderStatus(workshopId: string, serviceRecordId: string, status: WorkOrderStatus) {
  const values: Partial<typeof serviceRecords.$inferInsert> = { status };
  if (status === "ready") values.readyAt = new Date();
  await getDatabase().update(serviceRecords).set(values).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId)));
}

export async function finalizeWorkOrder(input: { workshopId: string; serviceRecordId: string; paymentMethod: string; paymentStatus: string; warrantyDays: number | null; deliveredOdometer: number | null; returnIntervalDays: number | null; nextDueAt: Date | null }) {
  const database = getDatabase();
  await database.transaction(async (tx) => {
    const [order] = await tx.select({ id: serviceRecords.id, status: serviceRecords.status, description: serviceRecords.description }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId))).limit(1);
    if (!order || order.status !== "ready") throw new Error("A ordem precisa estar pronta antes da entrega.");
    const parts = await tx.select({ inventoryItemId: workOrderItems.inventoryItemId, quantity: workOrderItems.quantity, description: workOrderItems.description }).from(workOrderItems).where(and(eq(workOrderItems.workshopId, input.workshopId), eq(workOrderItems.serviceRecordId, input.serviceRecordId), eq(workOrderItems.type, "part")));
    for (const part of parts) {
      if (!part.inventoryItemId) continue;
      const [stock] = await tx.update(inventoryItems).set({ currentQuantity: sql`${inventoryItems.currentQuantity} - ${part.quantity}` }).where(and(eq(inventoryItems.workshopId, input.workshopId), eq(inventoryItems.id, part.inventoryItemId), sql`${inventoryItems.currentQuantity} >= ${part.quantity}`)).returning({ id: inventoryItems.id });
      if (!stock) throw new Error(`Estoque insuficiente para ${part.description}.`);
      await tx.insert(inventoryMovements).values({ workshopId: input.workshopId, inventoryItemId: part.inventoryItemId, serviceRecordId: input.serviceRecordId, type: "consumption", quantityDelta: -part.quantity, note: order.description });
    }
    const now = new Date();
    await tx.update(serviceRecords).set({ status: "delivered", completedAt: now, deliveredAt: now, paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, warrantyDays: input.warrantyDays, deliveredOdometer: input.deliveredOdometer, returnIntervalDays: input.returnIntervalDays, nextDueAt: input.nextDueAt }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
  });
}

export async function addServicePhoto(input: { workshopId: string; serviceRecordId: string; kind: "intake" | "diagnosis" | "completion"; caption: string | null; fileName: string; mimeType: string; dataBase64: string }) {
  const [order] = await getDatabase().select({ id: serviceRecords.id }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId))).limit(1);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  await getDatabase().insert(servicePhotos).values(input);
}

export async function getServicePhoto(workshopId: string, photoId: string) {
  if (!validUuid(photoId)) return null;
  const [photo] = await getDatabase().select({ mimeType: servicePhotos.mimeType, dataBase64: servicePhotos.dataBase64, fileName: servicePhotos.fileName }).from(servicePhotos).where(and(eq(servicePhotos.workshopId, workshopId), eq(servicePhotos.id, photoId))).limit(1);
  return photo ?? null;
}
