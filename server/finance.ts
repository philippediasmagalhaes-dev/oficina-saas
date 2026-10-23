import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import { collaboratorServiceRates, collaborators, financialAttachments, financialEntries, paymentFeeRules, serviceRecords, workOrderItemAssignments, workOrderItems, workOrderPayments, workshopFinancialSettings } from "../db/schema";
import { calculateFinancialClosing, type FinancialClosing, type FinancialClosingInput } from "../domain/financial-closing";

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
  const grossTotal = items.reduce((sum, item) => sum + item.grossCents, 0);
  let allocated = 0;
  return items.map((item, index) => {
    const discountCents = index === items.length - 1 ? totalDiscount - allocated : grossTotal ? Math.round(totalDiscount * item.grossCents / grossTotal) : 0;
    allocated += discountCents;
    return { ...item, discountCents: Math.min(discountCents, item.grossCents) };
  });
}

export async function closeWorkOrderFinancialsTx(tx: DatabaseTransaction, input: { workshopId: string; serviceRecordId: string; payments: PaymentDraft[]; now?: Date }) {
  const now = input.now ?? new Date();
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
    laborItems.push({ id: item.id, grossCents: Number(item.grossCents), discountCents: discounted.find((value) => value.id === item.id)?.discountCents ?? 0, assignments: assignments.map((assignment) => ({ id: assignment.id, collaboratorId: assignment.collaboratorId, mode: assignment.mode, participationBasisPoints: assignment.participationBasisPoints, commissionBasisPoints: assignment.overrideCommission ?? assignment.defaultCommission, fixedPerServiceCents: assignment.overrideFixed ?? assignment.defaultFixed })) });
  }
  const paymentInputs = [] as FinancialClosingInput["payments"];
  for (const [index, payment] of input.payments.entries()) {
    const rule = await activeFeeRule(tx, input.workshopId, payment.paymentMethod, payment.installmentCount);
    paymentInputs.push({ id: `${index}`, method: payment.paymentMethod, amountCents: payment.amountCents, installmentCount: payment.installmentCount, percentageBasisPoints: rule?.percentageBasisPoints ?? 0, fixedFeeCents: rule?.fixedFeeCents ?? 0, manualFeeCents: payment.manualFeeCents });
  }
  const result = calculateFinancialClosing({ orderTotalCents: order.amountCents, taxBasisPoints: order.taxBasisPoints ?? settings?.defaultTaxBasisPoints ?? 0, payments: paymentInputs, laborItems });
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
  if (result.taxReserveCents > 0) await tx.insert(financialEntries).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, externalId: `os:${input.serviceRecordId}:tax`, direction: "reserve", category: "tax_reserve", description: `Provisão de imposto OS ${order.orderNumber ?? ""}`.trim(), grossAmountCents: result.taxReserveCents, netAmountCents: result.taxReserveCents, competenceDate: now, dueDate: now, status: "expected" }).onConflictDoNothing();
  for (const assignment of result.assignments) {
    await tx.update(workOrderItemAssignments).set({ laborBaseCentsSnapshot: assignment.laborBaseCents, compensationCentsSnapshot: assignment.compensationCents, commissionBasisPointsSnapshot: assignment.commissionBasisPoints, fixedPerServiceCentsSnapshot: assignment.fixedPerServiceCents, completedAt: now, updatedAt: now }).where(and(eq(workOrderItemAssignments.workshopId, input.workshopId), eq(workOrderItemAssignments.id, assignment.id)));
    if (assignment.compensationCents > 0) await tx.insert(financialEntries).values({ workshopId: input.workshopId, serviceRecordId: input.serviceRecordId, collaboratorId: assignment.collaboratorId, externalId: `os:${input.serviceRecordId}:commission:${assignment.id}`, direction: "expense", category: "labor_compensation", description: `Remuneração OS ${order.orderNumber ?? ""}`.trim(), grossAmountCents: assignment.compensationCents, netAmountCents: assignment.compensationCents, competenceDate: now, dueDate: now, status: "expected" }).onConflictDoNothing();
  }
  await tx.update(serviceRecords).set({ financialClosedAt: now, taxBasisPoints: order.taxBasisPoints ?? settings?.defaultTaxBasisPoints ?? 0, taxReserveCents: result.taxReserveCents, feeTotalCents: result.feeTotalCents, netTotalCents: result.netTotalCents, paymentMethod: input.payments.length === 1 ? input.payments[0].paymentMethod : "split", paymentStatus: input.payments.every((payment) => payment.paid) ? "paid" : "pending", updatedAt: now }).where(and(eq(serviceRecords.workshopId, input.workshopId), eq(serviceRecords.id, input.serviceRecordId)));
  return result;
}

export async function closeWorkOrderFinancials(input: { workshopId: string; serviceRecordId: string; payments: PaymentDraft[]; now?: Date }) {
  return runDatabaseTransaction((tx) => closeWorkOrderFinancialsTx(tx, input));
}

export type FinancialEntryFilters = { from?: Date; to?: Date; status?: string; category?: string; recognitionMode?: "cash" | "accrual"; paymentMethod?: string; collaboratorId?: string };

export async function listFinancialEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  return getDatabase().select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lte(recognitionColumn, filters.to) : undefined, filters.status ? eq(financialEntries.status, filters.status as "expected" | "settled" | "cancelled") : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined)).orderBy(desc(financialEntries.competenceDate));
}

export async function listFinancialReportEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  return getDatabase().select({ id: financialEntries.id, externalId: financialEntries.externalId, direction: financialEntries.direction, category: financialEntries.category, description: financialEntries.description, grossAmountCents: financialEntries.grossAmountCents, feeAmountCents: financialEntries.feeAmountCents, netAmountCents: financialEntries.netAmountCents, competenceDate: financialEntries.competenceDate, dueDate: financialEntries.dueDate, settledAt: financialEntries.settledAt, status: financialEntries.status, paymentMethod: workOrderPayments.paymentMethod, collaboratorId: financialEntries.collaboratorId, collaboratorName: collaborators.name, serviceRecordId: financialEntries.serviceRecordId }).from(financialEntries).leftJoin(workOrderPayments, and(eq(workOrderPayments.id, financialEntries.paymentId), eq(workOrderPayments.workshopId, workshopId))).leftJoin(collaborators, and(eq(collaborators.id, financialEntries.collaboratorId), eq(collaborators.workshopId, workshopId))).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lte(recognitionColumn, filters.to) : undefined, filters.status ? eq(financialEntries.status, filters.status as "expected" | "settled" | "cancelled") : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined, filters.paymentMethod ? eq(workOrderPayments.paymentMethod, filters.paymentMethod) : undefined, filters.collaboratorId ? eq(financialEntries.collaboratorId, filters.collaboratorId) : undefined)).orderBy(desc(financialEntries.competenceDate));
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
  const rows = await getDatabase().select().from(collaborators).where(and(eq(collaborators.workshopId, workshopId), eq(collaborators.active, true), eq(collaborators.compensationMode, "fixed_monthly")));
  for (const collaborator of rows) {
    if (!collaborator.monthlyFixedCents) continue;
    await getDatabase().insert(financialEntries).values({ workshopId, collaboratorId: collaborator.id, externalId: `monthly:${collaborator.id}:${monthKey}`, direction: "expense", category: "fixed_payroll", description: `Pagamento mensal — ${collaborator.name}`, grossAmountCents: collaborator.monthlyFixedCents, netAmountCents: collaborator.monthlyFixedCents, competenceDate, dueDate, status: "expected", recurrenceKey: `monthly:${collaborator.id}` }).onConflictDoNothing();
  }
}

export async function addFinancialAttachmentMetadata(input: { workshopId: string; financialEntryId: string; storageKey: string; fileName: string; mimeType: string; sizeBytes: number }) {
  const [entry] = await getDatabase().select({ id: financialEntries.id }).from(financialEntries).where(and(eq(financialEntries.workshopId, input.workshopId), eq(financialEntries.id, input.financialEntryId))).limit(1);
  if (!entry) throw new Error("Lançamento financeiro não encontrado.");
  const [row] = await getDatabase().insert(financialAttachments).values(input).returning();
  return row;
}
