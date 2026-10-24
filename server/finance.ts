import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne, notExists, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import { businessFinExports, collaboratorServiceRates, collaborators, financialAttachments, financialEntries, financialEntryEvents, paymentFeeRules, serviceRecords, workOrderItemAssignments, workOrderItems, workOrderPayments, workshopFinancialSettings } from "../db/schema";
import { calculateFinancialClosing, type FinancialClosing, type FinancialClosingInput } from "../domain/financial-closing";
import { hasMonthlyCompensation, validateParticipationTotal } from "../domain/commissions";
import { allocateCentsProportionally } from "../domain/money";

export interface FinancialCloseStore {
  load(workshopId: string, serviceRecordId: string): Promise<{ state: "closed"; result: FinancialClosing } | { state: "open"; input: FinancialClosingInput }>;
  persist(workshopId: string, serviceRecordId: string, result: FinancialClosing): Promise<FinancialClosing>;
}

export async function closeFinancialOrder(store: FinancialCloseStore, workshopId: string, serviceRecordId: string) {
  const state = await store.load(workshopId, serviceRecordId);
  if (state.state === "closed") return state.result;
  return store.persist(workshopId, serviceRecordId, calculateFinancialClosing(state.input));
}

export type PaymentDraft = { paymentMethod: string; amountCents: number; installmentCount: number; paid: boolean; expectedAt: Date; manualFeeCents: number | null };

export async function saveFinancialSettings(input: { workshopId: string; defaultTaxBasisPoints: number; defaultRecognitionMode: "cash" | "accrual" }) {
  const [row] = await getDatabase().insert(workshopFinancialSettings).values(input).onConflictDoUpdate({ target: workshopFinancialSettings.workshopId, set: { defaultTaxBasisPoints: input.defaultTaxBasisPoints, defaultRecognitionMode: input.defaultRecognitionMode, updatedAt: new Date() } }).returning();
  return row;
}

export async function savePaymentFeeRule(input: { workshopId: string; paymentMethod: string; installmentCount: number; percentageBasisPoints: number; fixedFeeCents: number }) {
  const database = getDatabase();
  await database.update(paymentFeeRules).set({ active: false, effectiveUntil: new Date(), updatedAt: new Date() }).where(and(eq(paymentFeeRules.workshopId, input.workshopId), eq(paymentFeeRules.paymentMethod, input.paymentMethod), eq(paymentFeeRules.installmentCount, input.installmentCount), eq(paymentFeeRules.active, true)));
  const [row] = await database.insert(paymentFeeRules).values(input).returning();
  return row;
}

export async function getFinancialSettings(workshopId: string) {
  const database = getDatabase();
  const [[settings], feeRules] = await Promise.all([
    database.select().from(workshopFinancialSettings).where(eq(workshopFinancialSettings.workshopId, workshopId)).limit(1),
    database.select().from(paymentFeeRules).where(and(eq(paymentFeeRules.workshopId, workshopId), eq(paymentFeeRules.active, true))).orderBy(paymentFeeRules.paymentMethod, paymentFeeRules.installmentCount),
  ]);
  return { settings: settings ?? { defaultTaxBasisPoints: 0, defaultRecognitionMode: "cash" }, feeRules };
}

async function activeFeeRule(tx: DatabaseTransaction, workshopId: string, method: string, installments: number) {
  const [rule] = await tx.select().from(paymentFeeRules).where(and(eq(paymentFeeRules.workshopId, workshopId), eq(paymentFeeRules.paymentMethod, method), eq(paymentFeeRules.installmentCount, installments), eq(paymentFeeRules.active, true))).orderBy(desc(paymentFeeRules.effectiveFrom)).limit(1);
  return rule;
}

function distributeDiscount(items: Array<{ id: string; grossCents: number }>, totalDiscount: number) {
  const allocations = allocateCentsProportionally(totalDiscount, items.map((item) => item.grossCents));
  return items.map((item, index) => ({ ...item, discountCents: allocations[index] }));
}

export async function closeWorkOrderFinancialsTx(tx: DatabaseTransaction, input: { workshopId: string; serviceRecordId: string; payments: PaymentDraft[]; taxBasisPoints?: number; now?: Date }) {
  const now = input.now ?? new Date();
  await tx.execute(sql`select id from service_records where workshop_id = ${input.workshopId} and id = ${input.serviceRecordId} for update`);
  const [order] = await tx.select().from(serviceRecords).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId))).limit(1);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  if (order.financialClosedAt) {
    return { orderTotalCents: order.amountCents, feeTotalCents: order.feeTotalCents, taxReserveCents: order.taxReserveCents, compensationTotalCents: 0, netTotalCents: order.netTotalCents, payments: [], assignments: [] } satisfies FinancialClosing;
  }
  const [settings] = await tx.select().from(workshopFinancialSettings).where(eq(workshopFinancialSettings.workshopId, input.workshopId)).limit(1);
  const itemRows = await tx.select({ id: workOrderItems.id, type: workOrderItems.type, serviceCatalogId: workOrderItems.serviceCatalogId, grossCents: sql<number>`${workOrderItems.quantity} * ${workOrderItems.unitPriceCents}` }).from(workOrderItems).where(and(eq(workOrderItems.workshopId, input.workshopId), eq(workOrderItems.serviceRecordId, input.serviceRecordId))).orderBy(asc(workOrderItems.createdAt));
  const discounted = distributeDiscount(itemRows.map(({ id, grossCents }) => ({ id, grossCents: Number(grossCents) })), order.quoteDiscountCents);
  const laborItems = [] as FinancialClosingInput["laborItems"];
  for (const item of itemRows.filter((row) => row.type === "service")) {
    const assignments = await tx.select({ id: workOrderItemAssignments.id, collaboratorId: workOrderItemAssignments.collaboratorId, participationBasisPoints: workOrderItemAssignments.participationBasisPoints, mode: collaborators.compensationMode, defaultCommission: collaborators.commissionBasisPoints, defaultFixed: collaborators.fixedPerServiceCents, overrideCommission: collaboratorServiceRates.commissionBasisPoints, overrideFixed: collaboratorServiceRates.fixedPerServiceCents }).from(workOrderItemAssignments).innerJoin(collaborators, and(eq(collaborators.id, workOrderItemAssignments.collaboratorId), eq(collaborators.workshopId, input.workshopId))).leftJoin(collaboratorServiceRates, and(eq(collaboratorServiceRates.workshopId, input.workshopId), eq(collaboratorServiceRates.collaboratorId, collaborators.id), item.serviceCatalogId ? eq(collaboratorServiceRates.serviceCatalogId, item.serviceCatalogId) : sql`false`)).where(and(eq(workOrderItemAssignments.workshopId, input.workshopId), eq(workOrderItemAssignments.workOrderItemId, item.id)));
    validateParticipationTotal(assignments.map((assignment) => assignment.participationBasisPoints));
    laborItems.push({ id: item.id, grossCents: Number(item.grossCents), discountCents: discounted.find((value) => value.id === item.id)?.discountCents ?? 0, assignments: assignments.map((assignment) => ({ id: assignment.id, collaboratorId: assignment.collaboratorId, mode: assignment.mode, participationBasisPoints: assignment.participationBasisPoints, commissionBasisPoints: assignment.overrideCommission ?? assignment.defaultCommission, fixedPerServiceCents: assignment.overrideFixed ?? assignment.defaultFixed })) });
  }
  const paymentInputs = [] as FinancialClosingInput["payments"];
  for (const [index, payment] of input.payments.entries()) {
    const rule = await activeFeeRule(tx, input.workshopId, payment.paymentMethod, payment.installmentCount);
    paymentInputs.push({ id: `${index}`, method: payment.paymentMethod, amountCents: payment.amountCents, installmentCount: payment.installmentCount, percentageBasisPoints: rule?.percentageBasisPoints ?? 0, fixedFeeCents: rule?.fixedFeeCents ?? 0, manualFeeCents: payment.manualFeeCents });
  }
  const appliedTaxBasisPoints = input.taxBasisPoints ?? order.taxBasisPoints ?? settings?.defaultTaxBasisPoints ?? 0;
  const result = calculateFinancialClosing({ orderTotalCents: order.amountCents, taxBasisPoints: appliedTaxBasisPoints, payments: paymentInputs, laborItems });
  const persistedPayments: Array<{ id: string; resultIndex: number }> = [];
  for (const [index, payment] of input.payments.entries()) {
    const calculated = result.payments[index];
    const [row] = await tx.insert(workOrderPayments).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, paymentMethod: payment.paymentMethod, amountCents: payment.amountCents, installmentCount: payment.installmentCount, paidAt: payment.paid ? now : null, expectedAt: payment.expectedAt, status: payment.paid ? "paid" : "expected", feePercentageBasisPoints: calculated.percentageBasisPoints, feeFixedCents: calculated.fixedFeeCents, manualFeeCents: payment.manualFeeCents, feeAmountCents: calculated.feeAmountCents, netAmountCents: calculated.netAmountCents }).returning({ id: workOrderPayments.id });
    persistedPayments.push({ id: row.id, resultIndex: index });
  }
  for (const payment of persistedPayments) {
    const calculated = result.payments[payment.resultIndex];
    const draft = input.payments[payment.resultIndex];
    await tx.insert(financialEntries).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, paymentId: payment.id, externalId: `os:${input.serviceRecordId}:payment:${payment.resultIndex + 1}`, direction: "income", category: "service_income", description: `Recebimento OS ${order.orderNumber ?? ""}`.trim(), grossAmountCents: calculated.amountCents, feeAmountCents: calculated.feeAmountCents, netAmountCents: calculated.netAmountCents, competenceDate: now, dueDate: draft.expectedAt, settledAt: draft.paid ? now : null, status: draft.paid ? "settled" : "expected" }).onConflictDoNothing();
  }
  const taxShares = result.taxReserveCents > 0 ? allocateCentsProportionally(result.taxReserveCents, result.payments.map((payment) => payment.amountCents)) : result.payments.map(() => 0);
  for (const payment of persistedPayments) {
    const taxCents = taxShares[payment.resultIndex];
    if (!taxCents) continue;
    const draft = input.payments[payment.resultIndex];
    await tx.insert(financialEntries).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, paymentId: payment.id, externalId: `os:${input.serviceRecordId}:tax:${payment.resultIndex + 1}`, direction: "reserve", category: "tax_reserve", description: `Provisão de imposto OS ${order.orderNumber ?? ""}`.trim(), grossAmountCents: taxCents, netAmountCents: taxCents, competenceDate: now, dueDate: draft.expectedAt, settledAt: draft.paid ? now : null, status: draft.paid ? "settled" : "expected" }).onConflictDoNothing();
  }
  for (const assignment of result.assignments) {
    await tx.update(workOrderItemAssignments).set({ laborBaseCentsSnapshot: assignment.laborBaseCents, compensationCentsSnapshot: assignment.compensationCents, commissionBasisPointsSnapshot: assignment.commissionBasisPoints, fixedPerServiceCentsSnapshot: assignment.fixedPerServiceCents, completedAt: now, updatedAt: now }).where(and(eq(workOrderItemAssignments.workshopId, input.workshopId), eq(workOrderItemAssignments.id, assignment.id)));
    if (assignment.compensationCents > 0) await tx.insert(financialEntries).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, collaboratorId: assignment.collaboratorId, externalId: `os:${input.serviceRecordId}:commission:${assignment.id}`, direction: "expense", category: "labor_compensation", description: `Remuneração OS ${order.orderNumber ?? ""}`.trim(), grossAmountCents: assignment.compensationCents, netAmountCents: assignment.compensationCents, competenceDate: now, dueDate: now, status: "expected" }).onConflictDoNothing();
  }
  await tx.update(serviceRecords).set({ financialClosedAt: now, taxBasisPoints: appliedTaxBasisPoints, taxReserveCents: result.taxReserveCents, feeTotalCents: result.feeTotalCents, netTotalCents: result.netTotalCents, paymentMethod: input.payments.length === 1 ? input.payments[0].paymentMethod : "split", paymentStatus: input.payments.every((payment) => payment.paid) ? "paid" : "pending", updatedAt: now }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
  return result;
}

export async function closeWorkOrderFinancials(input: { workshopId: string; serviceRecordId: string; payments: PaymentDraft[]; now?: Date }) {
  return runDatabaseTransaction((tx) => closeWorkOrderFinancialsTx(tx, input));
}

export type FinancialEntryFilters = { from?: Date; to?: Date; status?: string; category?: string; recognitionMode?: "cash" | "accrual"; paymentMethod?: string; collaboratorId?: string };

export async function listFinancialEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  return getDatabase().select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lt(recognitionColumn, filters.to) : undefined, filters.status ? eq(financialEntries.status, filters.status as "expected" | "settled" | "cancelled") : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined)).orderBy(desc(financialEntries.competenceDate));
}

export async function listFinancialReportEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  return getDatabase().select({ id: financialEntries.id, externalId: financialEntries.externalId, direction: financialEntries.direction, category: financialEntries.category, description: financialEntries.description, grossAmountCents: financialEntries.grossAmountCents, feeAmountCents: financialEntries.feeAmountCents, netAmountCents: financialEntries.netAmountCents, competenceDate: financialEntries.competenceDate, dueDate: financialEntries.dueDate, settledAt: financialEntries.settledAt, status: financialEntries.status, paymentId: financialEntries.paymentId, paymentMethod: workOrderPayments.paymentMethod, collaboratorId: financialEntries.collaboratorId, collaboratorName: collaborators.name, serviceRecordId: financialEntries.serviceRecordId }).from(financialEntries).leftJoin(workOrderPayments, and(eq(workOrderPayments.id, financialEntries.paymentId), eq(workOrderPayments.workshopId, workshopId))).leftJoin(collaborators, and(eq(collaborators.id, financialEntries.collaboratorId), eq(collaborators.workshopId, workshopId))).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lt(recognitionColumn, filters.to) : undefined, filters.status ? eq(financialEntries.status, filters.status as "expected" | "settled" | "cancelled") : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined, filters.paymentMethod ? eq(workOrderPayments.paymentMethod, filters.paymentMethod) : undefined, filters.collaboratorId ? eq(financialEntries.collaboratorId, filters.collaboratorId) : undefined)).orderBy(desc(financialEntries.competenceDate));
}

export async function createManualFinancialEntry(input: { workshopId: string; direction: "income" | "expense" | "reserve"; category: string; description: string; amountCents: number; competenceDate: Date; dueDate: Date; settled: boolean; recurrenceKey?: string | null }) {
  const externalId = `manual:${crypto.randomUUID()}`;
  const [row] = await getDatabase().insert(financialEntries).values({ workshopId: input.workshopId, externalId, direction: input.direction, category: input.category, description: input.description, grossAmountCents: input.amountCents, netAmountCents: input.amountCents, competenceDate: input.competenceDate, dueDate: input.dueDate, settledAt: input.settled ? new Date() : null, status: input.settled ? "settled" : "expected", recurrenceKey: input.recurrenceKey ?? null }).returning();
  return row;
}

export async function ensureMonthlyCollaboratorPayables(workshopId: string, month = new Date()) {
  const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  const competenceDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const dueDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 5));
  const rows = await getDatabase().select().from(collaborators).where(and(eq(collaborators.workshopId, workshopId), eq(collaborators.active, true), inArray(collaborators.compensationMode, ["fixed_monthly", "hybrid"])));
  for (const collaborator of rows) {
    if (!hasMonthlyCompensation(collaborator.compensationMode)) continue;
    if (!collaborator.monthlyFixedCents) continue;
    await getDatabase().insert(financialEntries).values({ workshopId, collaboratorId: collaborator.id, externalId: `monthly:${collaborator.id}:${monthKey}`, direction: "expense", category: "fixed_payroll", description: `Pagamento mensal — ${collaborator.name}`, grossAmountCents: collaborator.monthlyFixedCents, netAmountCents: collaborator.monthlyFixedCents, competenceDate, dueDate, status: "expected", recurrenceKey: `monthly:${collaborator.id}` }).onConflictDoNothing();
  }
}

export async function setFinancialEntrySettlement(workshopId: string, financialEntryId: string, settle: boolean, now = new Date()) {
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from financial_entries where workshop_id = ${workshopId} and id = ${financialEntryId} for update`);
    const [entry] = await tx.select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).limit(1);
    if (!entry || entry.status === "cancelled") throw new Error("Lançamento financeiro não encontrado.");
    const toStatus: "settled" | "expected" = settle ? "settled" : "expected";
    if (entry.status === toStatus) return entry;
    const [updated] = await tx.update(financialEntries).set({ status: toStatus, settledAt: settle ? now : null, updatedAt: now }).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).returning();
    await tx.insert(financialEntryEvents).values({ workshopId, financialEntryId, fromStatus: entry.status, toStatus, occurredAt: now });
    if (entry.paymentId) {
      await tx.update(workOrderPayments).set({ status: settle ? "paid" : "expected", paidAt: settle ? now : null, updatedAt: now }).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.id, entry.paymentId)));
      const linkedTaxEntries = await tx.select({ id: financialEntries.id, status: financialEntries.status }).from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.paymentId, entry.paymentId), eq(financialEntries.category, "tax_reserve"), ne(financialEntries.status, toStatus)));
      if (linkedTaxEntries.length) {
        await tx.update(financialEntries).set({ status: toStatus, settledAt: settle ? now : null, updatedAt: now }).where(and(eq(financialEntries.workshopId, workshopId), inArray(financialEntries.id, linkedTaxEntries.map((tax) => tax.id))));
        await tx.insert(financialEntryEvents).values(linkedTaxEntries.map((tax) => ({ workshopId, financialEntryId: tax.id, fromStatus: tax.status, toStatus, occurredAt: now })));
      }
      if (entry.serviceRecordId) {
        const [outstanding] = await tx.select({ id: workOrderPayments.id }).from(workOrderPayments).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.serviceRecordId, entry.serviceRecordId), eq(workOrderPayments.status, "expected"))).limit(1);
        await tx.update(serviceRecords).set({ paymentStatus: outstanding ? "pending" : "paid", updatedAt: now }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, entry.serviceRecordId)));
      }
    }
    return updated;
  });
}

export async function claimBusinessFinEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  return runDatabaseTransaction(async (tx) => {
    const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
    const unexported = tx.select({ workshopId: financialEntries.workshopId, financialEntryId: financialEntries.id, externalId: financialEntries.externalId }).from(financialEntries).leftJoin(workOrderPayments, and(eq(workOrderPayments.id, financialEntries.paymentId), eq(workOrderPayments.workshopId, workshopId))).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lt(recognitionColumn, filters.to) : undefined, filters.status ? eq(financialEntries.status, filters.status as "expected" | "settled" | "cancelled") : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined, filters.paymentMethod ? eq(workOrderPayments.paymentMethod, filters.paymentMethod) : undefined, filters.collaboratorId ? eq(financialEntries.collaboratorId, filters.collaboratorId) : undefined, notExists(tx.select({ id: businessFinExports.id }).from(businessFinExports).where(and(eq(businessFinExports.workshopId, workshopId), eq(businessFinExports.financialEntryId, financialEntries.id))))));
    const claimed = await tx.insert(businessFinExports).select(unexported).onConflictDoNothing().returning({ financialEntryId: businessFinExports.financialEntryId });
    if (!claimed.length) return [];
    return tx.select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), inArray(financialEntries.id, claimed.map((row) => row.financialEntryId)))).orderBy(desc(financialEntries.competenceDate));
  });
}

export function monthlyOccurrenceDate(year: number, zeroBasedMonth: number, preferredDay: number) {
  const lastDay = new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, zeroBasedMonth, Math.min(preferredDay, lastDay)));
}

export async function ensureMonthlyFinancialOccurrences(workshopId: string, month = new Date()) {
  const database = getDatabase();
  const rows = await database.select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), isNotNull(financialEntries.recurrenceKey), ne(financialEntries.category, "fixed_payroll"))).orderBy(asc(financialEntries.competenceDate));
  const templates = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (row.recurrenceKey && !templates.has(row.recurrenceKey)) templates.set(row.recurrenceKey, row);
  const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  for (const [recurrenceKey, template] of templates) {
    const templateMonth = `${template.competenceDate.getUTCFullYear()}-${String(template.competenceDate.getUTCMonth() + 1).padStart(2, "0")}`;
    if (templateMonth === monthKey || template.competenceDate > month) continue;
    const competenceDate = monthlyOccurrenceDate(month.getUTCFullYear(), month.getUTCMonth(), template.competenceDate.getUTCDate());
    const dueDate = monthlyOccurrenceDate(month.getUTCFullYear(), month.getUTCMonth(), template.dueDate.getUTCDate());
    await database.insert(financialEntries).values({ workshopId, externalId: `recurrence:${recurrenceKey}:${monthKey}`, direction: template.direction, category: template.category, description: template.description, grossAmountCents: template.grossAmountCents, feeAmountCents: template.feeAmountCents, netAmountCents: template.netAmountCents, competenceDate, dueDate, status: "expected", recurrenceKey }).onConflictDoNothing();
  }
}

export async function addFinancialAttachmentMetadata(input: { workshopId: string; financialEntryId: string; storageKey: string; fileName: string; mimeType: string; sizeBytes: number }) {
  const [entry] = await getDatabase().select({ id: financialEntries.id }).from(financialEntries).where(and(eq(financialEntries.workshopId, input.workshopId), eq(financialEntries.id, input.financialEntryId))).limit(1);
  if (!entry) throw new Error("Lançamento financeiro não encontrado.");
  const [row] = await getDatabase().insert(financialAttachments).values(input).returning();
  return row;
}

export async function listWorkOrderPayments(workshopId: string, serviceRecordId: string) {
  return getDatabase().select({ id: workOrderPayments.id, paymentMethod: workOrderPayments.paymentMethod, amountCents: workOrderPayments.amountCents, installmentCount: workOrderPayments.installmentCount, expectedAt: workOrderPayments.expectedAt, paidAt: workOrderPayments.paidAt, status: workOrderPayments.status, feeAmountCents: workOrderPayments.feeAmountCents, netAmountCents: workOrderPayments.netAmountCents }).from(workOrderPayments).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.serviceRecordId, serviceRecordId))).orderBy(workOrderPayments.createdAt);
}
