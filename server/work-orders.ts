import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import {
  customers,
  inventoryItems,
  serviceCatalogItems,
  servicePhotos,
  serviceRecords,
  vehicles,
  workOrderApprovals,
  workOrderItems,
  workOrderStatusEvents,
  workshops,
} from "../db/schema";
import { calculateQuoteTotal, canTransitionWorkOrder, nextQuotePublication, nextQuoteVersion, type WorkOrderStatus } from "../domain/work-orders";
import {
  createPhotoService,
  type NewPhotoMetadata,
  type PhotoRepository,
} from "./photo-service";
import {
  createR2PhotoStorage,
  readPhotoStorageConfig,
} from "./photo-storage";
import { createDrizzleSequenceStore, nextWorkOrderNumber } from "./work-order-number";
import { getInspection } from "./inspections";
import { consumeReservedOrderStockTx, releaseCancelledOrderStockTx, reserveApprovedOrderStockTx } from "./inventory";
import { closeWorkOrderFinancialsTx, type PaymentDraft } from "./finance";

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
  orderNumber: number | null;
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
  quoteVersion: number;
  approvedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  financialClosedAt: Date | null;
  paymentMethod: string | null;
  paymentStatus: string;
  taxBasisPoints: number | null;
  warrantyDays: number | null;
  deliveredOdometer: number | null;
  items: WorkOrderItemSummary[];
  photos: WorkOrderPhotoSummary[];
  subtotalCents: number;
  inspection: Awaited<ReturnType<typeof getInspection>>;
  statusEvents: { id: string; fromStatus: string | null; toStatus: string; note: string | null; occurredAt: Date }[];
  approvals: { id: string; quoteVersion: number; decision: string; source: string; customerNote: string | null; decidedAt: Date }[];
};

async function appendStatusEvent(transaction: Pick<DatabaseTransaction, "insert">, input: { workshopId: string; serviceRecordId: string; fromStatus: string | null; toStatus: string; note?: string | null }) {
  await transaction.insert(workOrderStatusEvents).values({ ...input, note: input.note ?? null });
}

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
      orderNumber: serviceRecords.orderNumber,
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
  if (!customer || !vehicle || vehicle.customerId !== customer.id) throw new Error("Cliente ou veículo não encontrados.");
  return runDatabaseTransaction(async (tx) => {
    const orderNumber = await nextWorkOrderNumber(createDrizzleSequenceStore(tx), input.workshopId);
    const [order] = await tx.insert(serviceRecords).values({
      workshopId: input.workshopId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      orderNumber,
      serviceCatalogId: null,
      description: input.complaint.slice(0, 120),
      complaint: input.complaint,
      status: "open",
      amountCents: 0,
      completedAt: null,
      odometer: input.odometer,
      notes: input.notes,
    }).returning({ id: serviceRecords.id, orderNumber: serviceRecords.orderNumber });
    await appendStatusEvent(tx, { workshopId: input.workshopId, serviceRecordId: order.id, fromStatus: null, toStatus: "open" });
    return order;
  });
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
    orderNumber: serviceRecords.orderNumber,
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
    quoteVersion: serviceRecords.quoteVersion,
    approvedAt: serviceRecords.approvedAt,
    readyAt: serviceRecords.readyAt,
    deliveredAt: serviceRecords.deliveredAt,
    financialClosedAt: serviceRecords.financialClosedAt,
    paymentMethod: serviceRecords.paymentMethod,
    paymentStatus: serviceRecords.paymentStatus,
    taxBasisPoints: serviceRecords.taxBasisPoints,
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
  const [items, photos, inspection, statusEvents, approvals] = await Promise.all([
    loadItems(workshopId, serviceRecordId),
    database.select({ id: servicePhotos.id, kind: servicePhotos.kind, caption: servicePhotos.caption, fileName: servicePhotos.fileName, uploadedAt: servicePhotos.uploadedAt }).from(servicePhotos).where(and(eq(servicePhotos.workshopId, workshopId), eq(servicePhotos.serviceRecordId, serviceRecordId))).orderBy(desc(servicePhotos.uploadedAt)),
    getInspection(workshopId, serviceRecordId),
    database.select({ id: workOrderStatusEvents.id, fromStatus: workOrderStatusEvents.fromStatus, toStatus: workOrderStatusEvents.toStatus, note: workOrderStatusEvents.note, occurredAt: workOrderStatusEvents.occurredAt }).from(workOrderStatusEvents).where(and(eq(workOrderStatusEvents.workshopId, workshopId), eq(workOrderStatusEvents.serviceRecordId, serviceRecordId))).orderBy(workOrderStatusEvents.occurredAt),
    database.select({ id: workOrderApprovals.id, quoteVersion: workOrderApprovals.quoteVersion, decision: workOrderApprovals.decision, source: workOrderApprovals.source, customerNote: workOrderApprovals.customerNote, decidedAt: workOrderApprovals.decidedAt }).from(workOrderApprovals).where(and(eq(workOrderApprovals.workshopId, workshopId), eq(workOrderApprovals.serviceRecordId, serviceRecordId))).orderBy(workOrderApprovals.decidedAt),
  ]);
  const totals = calculateQuoteTotal(items, order.quoteDiscountCents);
  return { ...order, items, photos, inspection, statusEvents, approvals, subtotalCents: totals.subtotalCents };
}

export async function saveDiagnosis(input: { workshopId: string; serviceRecordId: string; complaint: string; diagnosis: string; notes: string | null }) {
  await runDatabaseTransaction(async (tx) => {
    const [before] = await tx.select({ status: serviceRecords.status }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), inArray(serviceRecords.status, ["open", "diagnosis", "awaiting_approval"]))).limit(1);
    if (!before) throw new Error("Ordem de serviço não encontrada ou já finalizada.");
    await tx.update(serviceRecords).set({ complaint: input.complaint, diagnosis: input.diagnosis, notes: input.notes, description: input.complaint.slice(0, 120), status: "diagnosis", quoteStatus: "draft" }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
    if (before.status !== "diagnosis") await appendStatusEvent(tx, { workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, fromStatus: before.status, toStatus: "diagnosis" });
  });
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
  const [editableOrder] = await database.select({ id: serviceRecords.id, diagnosis: serviceRecords.diagnosis, quoteStatus: serviceRecords.quoteStatus, quoteVersion: serviceRecords.quoteVersion, quoteToken: serviceRecords.quoteToken }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), eq(serviceRecords.status, "diagnosis"))).limit(1);
  if (!editableOrder?.diagnosis) throw new Error("Salve o diagnóstico antes de publicar o orçamento.");
  await database.update(serviceRecords).set({ quoteDiscountCents: input.discountCents, quoteValidUntil: input.validUntil }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
  const totals = await recalculateWorkOrder(input.workshopId, input.serviceRecordId);
  if (totals.subtotalCents <= 0) throw new Error("Adicione pelo menos um item ao orçamento.");
  const publication = nextQuotePublication({ currentVersion: editableOrder.quoteVersion, quoteStatus: editableOrder.quoteStatus, currentToken: editableOrder.quoteToken, createToken: () => crypto.randomUUID() });
  await runDatabaseTransaction(async (tx) => {
    const [published] = await tx.update(serviceRecords).set({ quoteDiscountCents: totals.discountCents, amountCents: totals.totalCents, quoteStatus: "sent", status: "awaiting_approval", quoteVersion: publication.quoteVersion, quoteToken: publication.quoteToken, quoteRespondedAt: null }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId), eq(serviceRecords.status, "diagnosis"), eq(serviceRecords.quoteVersion, editableOrder.quoteVersion))).returning({ id: serviceRecords.id });
    if (!published) throw new Error("Não foi possível publicar o orçamento.");
    await appendStatusEvent(tx, { workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, fromStatus: "diagnosis", toStatus: "awaiting_approval" });
  });
}

export async function respondToQuote(token: string, response: "approved" | "rejected") {
  if (!validUuid(token)) return null;
  const now = new Date();
  return runDatabaseTransaction(async (tx) => {
    const toStatus = response === "approved" ? "approved" : "diagnosis";
    const [row] = await tx.update(serviceRecords).set({ quoteStatus: response, status: toStatus, quoteRespondedAt: now, approvedAt: response === "approved" ? now : null }).where(and(eq(serviceRecords.quoteToken, token), eq(serviceRecords.quoteStatus, "sent"), eq(serviceRecords.status, "awaiting_approval"), or(isNull(serviceRecords.quoteValidUntil), gte(serviceRecords.quoteValidUntil, now)))).returning({ id: serviceRecords.id, workshopId: serviceRecords.workshopId, quoteVersion: serviceRecords.quoteVersion, quoteToken: serviceRecords.quoteToken });
    if (!row) return null;
    await tx.insert(workOrderApprovals).values({ workshopId: row.workshopId, serviceRecordId: row.id, quoteVersion: row.quoteVersion, decision: response, publicToken: row.quoteToken });
    if (response === "approved") await reserveApprovedOrderStockTx(tx, row.workshopId, row.id);
    await appendStatusEvent(tx, { workshopId: row.workshopId, serviceRecordId: row.id, fromStatus: "awaiting_approval", toStatus });
    return { id: row.id };
  });
}

export async function recordOfflineQuoteDecision(workshopId: string, serviceRecordId: string, decision: "approved" | "rejected") {
  const now = new Date();
  return runDatabaseTransaction(async (tx) => {
    const toStatus = decision === "approved" ? "approved" : "diagnosis";
    const [row] = await tx.update(serviceRecords).set({ quoteStatus: decision, status: toStatus, quoteRespondedAt: now, approvedAt: decision === "approved" ? now : null }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId), eq(serviceRecords.quoteStatus, "sent"), eq(serviceRecords.status, "awaiting_approval"))).returning({ id: serviceRecords.id, quoteVersion: serviceRecords.quoteVersion, quoteToken: serviceRecords.quoteToken });
    if (!row) throw new Error("Orçamento não está aguardando aprovação.");
    await tx.insert(workOrderApprovals).values({ workshopId, serviceRecordId: row.id, quoteVersion: row.quoteVersion, decision, source: "owner_recorded", publicToken: row.quoteToken });
    if (decision === "approved") await reserveApprovedOrderStockTx(tx, workshopId, row.id);
    await appendStatusEvent(tx, { workshopId, serviceRecordId: row.id, fromStatus: "awaiting_approval", toStatus, note: "Decisão informada pelo proprietário" });
    return { id: row.id };
  });
}

export async function reopenApprovedQuote(workshopId: string, serviceRecordId: string) {
  return runDatabaseTransaction(async (tx) => {
    const [order] = await tx.select({ quoteVersion: serviceRecords.quoteVersion }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId), eq(serviceRecords.status, "approved"))).limit(1);
    if (!order) throw new Error("Somente um orçamento aprovado pode ser revisado.");
    await releaseCancelledOrderStockTx(tx, workshopId, serviceRecordId);
    const quoteVersion = nextQuoteVersion(order.quoteVersion);
    await tx.update(serviceRecords).set({ status: "diagnosis", quoteStatus: "draft", quoteVersion, quoteToken: crypto.randomUUID(), approvedAt: null, quoteRespondedAt: null }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId)));
    await appendStatusEvent(tx, { workshopId, serviceRecordId, fromStatus: "approved", toStatus: "diagnosis", note: `Orçamento reaberto na versão ${quoteVersion}` });
    return { id: serviceRecordId, quoteVersion };
  });
}

export async function getPublicQuote(token: string) {
  if (!validUuid(token)) return null;
  const database = getDatabase();
  const [order] = await database.select({ id: serviceRecords.id, orderNumber: serviceRecords.orderNumber, workshopId: serviceRecords.workshopId, quoteToken: serviceRecords.quoteToken, quoteVersion: serviceRecords.quoteVersion, quoteStatus: serviceRecords.quoteStatus, quoteValidUntil: serviceRecords.quoteValidUntil, quoteRespondedAt: serviceRecords.quoteRespondedAt, complaint: serviceRecords.complaint, diagnosis: serviceRecords.diagnosis, amountCents: serviceRecords.amountCents, quoteDiscountCents: serviceRecords.quoteDiscountCents, workshopName: workshops.name, customerName: customers.name, vehicleLabel: vehicleLabelSql() }).from(serviceRecords).innerJoin(workshops, eq(workshops.id, serviceRecords.workshopId)).innerJoin(customers, eq(customers.id, serviceRecords.customerId)).leftJoin(vehicles, eq(vehicles.id, serviceRecords.vehicleId)).where(eq(serviceRecords.quoteToken, token)).limit(1);
  if (!order) return null;
  const items = await loadItems(order.workshopId, order.id);
  return { ...order, items, subtotalCents: items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0) };
}

export async function updateWorkOrderStatus(workshopId: string, serviceRecordId: string, status: WorkOrderStatus) {
  await runDatabaseTransaction(async (tx) => {
    const [order] = await tx.select({ status: serviceRecords.status }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId))).limit(1);
    if (!order) throw new Error("Ordem de serviço não encontrada.");
    if (!canTransitionWorkOrder(order.status as WorkOrderStatus, status)) throw new Error("Mudança de status inválida.");
    const values: Partial<typeof serviceRecords.$inferInsert> = { status };
    if (status === "ready") values.readyAt = new Date();
    if ((order.status === "approved" && status === "in_progress") || (order.status === "in_progress" && status === "ready")) await consumeReservedOrderStockTx(tx, workshopId, serviceRecordId);
    if (status === "cancelled") await releaseCancelledOrderStockTx(tx, workshopId, serviceRecordId);
    await tx.update(serviceRecords).set(values).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, serviceRecordId)));
    await appendStatusEvent(tx, { workshopId, serviceRecordId, fromStatus: order.status, toStatus: status });
  });
}

export async function finalizeWorkOrder(input: { workshopId: string; serviceRecordId: string; payments: PaymentDraft[]; taxBasisPoints: number; warrantyDays: number | null; deliveredOdometer: number | null; returnIntervalDays: number | null; nextDueAt: Date | null }) {
  await runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from service_records where workshop_id = ${input.workshopId} and id = ${input.serviceRecordId} for update`);
    const [order] = await tx.select({ id: serviceRecords.id, status: serviceRecords.status, financialClosedAt: serviceRecords.financialClosedAt }).from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId))).limit(1);
    if (!order || order.status !== "ready" || order.financialClosedAt) throw new Error("A ordem precisa estar pronta e aberta antes da entrega.");
    const now = new Date();
    await consumeReservedOrderStockTx(tx, input.workshopId, input.serviceRecordId);
    await closeWorkOrderFinancialsTx(tx, { workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, payments: input.payments, taxBasisPoints: input.taxBasisPoints, now });
    await tx.update(serviceRecords).set({ status: "delivered", completedAt: now, deliveredAt: now, warrantyDays: input.warrantyDays, deliveredOdometer: input.deliveredOdometer, returnIntervalDays: input.returnIntervalDays, nextDueAt: input.nextDueAt }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
    await appendStatusEvent(tx, { workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, fromStatus: "ready", toStatus: "delivered" });
  });
}

function createDrizzlePhotoRepository(): PhotoRepository {
  return {
    async findOrder(workshopId, serviceRecordId) {
      const [order] = await getDatabase()
        .select({ id: serviceRecords.id })
        .from(serviceRecords)
        .where(
          and(
            eq(serviceRecords.workshopId, workshopId),
            eq(serviceRecords.id, serviceRecordId),
          ),
        )
        .limit(1);
      return order ?? null;
    },

    async insertPhoto(input: NewPhotoMetadata) {
      await getDatabase().insert(servicePhotos).values(input);
    },

    async findPhoto(workshopId, photoId) {
      const [photo] = await getDatabase()
        .select({
          id: servicePhotos.id,
          workshopId: servicePhotos.workshopId,
          serviceRecordId: servicePhotos.serviceRecordId,
          kind: servicePhotos.kind,
          caption: servicePhotos.caption,
          fileName: servicePhotos.fileName,
          mimeType: servicePhotos.mimeType,
          dataBase64: servicePhotos.dataBase64,
          storageKey: servicePhotos.storageKey,
          sizeBytes: servicePhotos.sizeBytes,
        })
        .from(servicePhotos)
        .where(
          and(
            eq(servicePhotos.workshopId, workshopId),
            eq(servicePhotos.id, photoId),
          ),
        )
        .limit(1);
      return photo ?? null;
    },
  };
}

function getPhotoService() {
  const config = readPhotoStorageConfig(process.env);
  if (!config.configured) {
    throw new Error(`Configuração pendente: ${config.missing.join(", ")}`);
  }
  return createPhotoService({
    storage: createR2PhotoStorage(config.values),
    repository: createDrizzlePhotoRepository(),
  });
}

export async function addServicePhoto(input: {
  workshopId: string;
  serviceRecordId: string;
  kind: "intake" | "diagnosis" | "completion";
  caption: string | null;
  fileName: string;
  mimeType: string;
  body: Uint8Array;
}) {
  return getPhotoService().upload(input);
}

export async function getServicePhoto(workshopId: string, photoId: string) {
  if (!validUuid(photoId)) return { status: "missing" as const };
  return getPhotoService().read(workshopId, photoId);
}
