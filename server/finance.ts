import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, ne, notExists, or, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction, type DatabaseTransaction } from "../db/client";
import { businessFinExports, cashSessions, collaboratorServiceRates, collaborators, financialAccounts, financialAttachments, financialEntries, financialEntryEvents, financialSettlements, paymentFeeRules, serviceRecords, suppliers, workOrderItemAssignments, workOrderItems, workOrderPayments, workshopFinancialSettings } from "../db/schema";
import { calculateFinancialClosing, type FinancialClosing, type FinancialClosingInput } from "../domain/financial-closing";
import { hasMonthlyCompensation, validateParticipationTotal } from "../domain/commissions";
import { allocateCentsProportionally } from "../domain/money";
import { calculateEntryBalance, deriveEntryStatus, splitInstallments, type OperationalFinancialStatus } from "../domain/financial-ledger";
import { normalizeFinancialFilters, type RawFinancialFilters } from "../domain/financial-filters";

export interface FinancialCloseStore {
  load(workshopId: string, serviceRecordId: string): Promise<{ state: "closed"; result: FinancialClosing } | { state: "open"; input: FinancialClosingInput }>;
  persist(workshopId: string, serviceRecordId: string, result: FinancialClosing): Promise<FinancialClosing>;
}

export async function closeFinancialOrder(store: FinancialCloseStore, workshopId: string, serviceRecordId: string) {
  const state = await store.load(workshopId, serviceRecordId);
  if (state.state === "closed") return state.result;
  return store.persist(workshopId, serviceRecordId, calculateFinancialClosing(state.input));
}

export type FinancialSettlementEntry = {
  id: string;
  workshopId: string;
  grossAmountCents: number;
  status: OperationalFinancialStatus;
};

export type FinancialSettlementRow = {
  id: string;
  amountCents: number;
  reversedAt: Date | null;
};

export interface FinancialSettlementStore {
  loadEntry(workshopId: string, financialEntryId: string): Promise<FinancialSettlementEntry | null>;
  listSettlements(workshopId: string, financialEntryId: string): Promise<FinancialSettlementRow[]>;
  createSettlement(input: {
    workshopId: string;
    financialEntryId: string;
    amountCents: number;
    settledAt: Date;
    financialAccountId?: string | null;
    paymentMethod?: string | null;
    note?: string | null;
    feeAmountCents?: number;
  }): Promise<FinancialSettlementRow>;
  reverseSettlement(workshopId: string, settlementId: string, reversedAt: Date, note?: string | null): Promise<void>;
  updateEntryStatus(
    workshopId: string,
    financialEntryId: string,
    status: OperationalFinancialStatus,
    occurredAt: Date,
  ): Promise<void>;
}

export async function applyFinancialSettlement(
  store: FinancialSettlementStore,
  input: {
    workshopId: string;
    financialEntryId: string;
    amountCents: number;
    settledAt: Date;
    financialAccountId?: string | null;
    paymentMethod?: string | null;
    note?: string | null;
    feeAmountCents?: number;
  },
) {
  const entry = await store.loadEntry(input.workshopId, input.financialEntryId);
  if (!entry || entry.status === "cancelled") throw new Error("Lançamento financeiro não encontrado.");
  const existing = await store.listSettlements(input.workshopId, input.financialEntryId);
  const before = calculateEntryBalance(entry.grossAmountCents, existing);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error("O valor da baixa deve ser positivo.");
  if (input.amountCents > before.balanceCents)
    throw new Error("A baixa não pode superar o saldo do lançamento.");
  const settlement = await store.createSettlement(input);
  const balanceCents = before.balanceCents - input.amountCents;
  const status = deriveEntryStatus(entry.grossAmountCents, balanceCents, false);
  await store.updateEntryStatus(input.workshopId, input.financialEntryId, status, input.settledAt);
  return {
    settlementId: settlement.id,
    status,
    settledCents: entry.grossAmountCents - balanceCents,
    balanceCents,
  };
}

export async function reverseFinancialSettlement(
  store: FinancialSettlementStore,
  input: {
    workshopId: string;
    financialEntryId: string;
    settlementId: string;
    reversedAt: Date;
    note?: string | null;
  },
) {
  const entry = await store.loadEntry(input.workshopId, input.financialEntryId);
  if (!entry || entry.status === "cancelled") throw new Error("Lançamento financeiro não encontrado.");
  const settlements = await store.listSettlements(input.workshopId, input.financialEntryId);
  const settlement = settlements.find((row) => row.id === input.settlementId);
  if (!settlement) throw new Error("Baixa financeira não encontrada.");
  if (settlement.reversedAt) throw new Error("Esta baixa já foi estornada.");
  await store.reverseSettlement(input.workshopId, input.settlementId, input.reversedAt, input.note);
  const recalculated = calculateEntryBalance(
    entry.grossAmountCents,
    settlements.map((row) => row.id === input.settlementId ? { ...row, reversedAt: input.reversedAt } : row),
  );
  const status = deriveEntryStatus(entry.grossAmountCents, recalculated.balanceCents, false);
  await store.updateEntryStatus(input.workshopId, input.financialEntryId, status, input.reversedAt);
  return { status, ...recalculated };
}

export type PaymentDraft = { paymentMethod: string; amountCents: number; installmentCount: number; paid: boolean; expectedAt: Date; manualFeeCents: number | null };

export function selectConfiguredPaymentFeeRule<T extends {
  paymentMethod: string;
  installmentCount: number;
  active: boolean;
  effectiveFrom: Date;
}>(rules: T[], method: string, installments: number): T | null {
  return rules
    .filter((rule) => rule.active && rule.paymentMethod === method && rule.installmentCount === installments)
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())[0] ?? null;
}

export async function saveFinancialSettings(input: { workshopId: string; defaultTaxBasisPoints: number; defaultRecognitionMode: "cash" | "accrual" }) {
  const [row] = await getDatabase().insert(workshopFinancialSettings).values(input).onConflictDoUpdate({ target: workshopFinancialSettings.workshopId, set: { defaultTaxBasisPoints: input.defaultTaxBasisPoints, defaultRecognitionMode: input.defaultRecognitionMode, updatedAt: new Date() } }).returning();
  return row;
}

export async function savePaymentFeeRule(input: { workshopId: string; paymentMethod: string; installmentCount: number; percentageBasisPoints: number; fixedFeeCents: number }) {
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.workshopId}:${input.paymentMethod}:${input.installmentCount}`}))`);
    await tx.update(paymentFeeRules).set({ active: false, effectiveUntil: new Date(), updatedAt: new Date() }).where(and(eq(paymentFeeRules.workshopId, input.workshopId), eq(paymentFeeRules.paymentMethod, input.paymentMethod), eq(paymentFeeRules.installmentCount, input.installmentCount), eq(paymentFeeRules.active, true)));
    const [row] = await tx.insert(paymentFeeRules).values(input).returning();
    return row;
  });
}

export async function deactivatePaymentFeeRule(workshopId: string, ruleId: string) {
  const rows = await getDatabase().update(paymentFeeRules).set({ active: false, effectiveUntil: new Date(), updatedAt: new Date() }).where(and(eq(paymentFeeRules.workshopId, workshopId), eq(paymentFeeRules.id, ruleId), eq(paymentFeeRules.active, true))).returning({ id: paymentFeeRules.id });
  if (!rows.length) throw new Error("Regra de taxa não encontrada.");
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
  const rules = await tx.select().from(paymentFeeRules).where(and(eq(paymentFeeRules.workshopId, workshopId), eq(paymentFeeRules.paymentMethod, method), eq(paymentFeeRules.active, true))).orderBy(desc(paymentFeeRules.effectiveFrom));
  return selectConfiguredPaymentFeeRule(rules, method, installments);
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

const operationalStatuses = ["expected", "partial", "settled", "cancelled"] as const;

function financialStatusValue(value?: string) {
  return operationalStatuses.includes(value as (typeof operationalStatuses)[number])
    ? value as (typeof operationalStatuses)[number]
    : undefined;
}

export async function listFinancialEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  const status = financialStatusValue(filters.status);
  return getDatabase().select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lt(recognitionColumn, filters.to) : undefined, status ? eq(financialEntries.status, status) : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined)).orderBy(desc(financialEntries.competenceDate));
}

export async function listFinancialEntriesPage(workshopId: string, rawFilters: RawFinancialFilters = {}) {
  const filters = normalizeFinancialFilters(rawFilters);
  const pattern = filters.search ? `%${filters.search}%` : undefined;
  const where = and(
    eq(financialEntries.workshopId, workshopId),
    filters.direction ? eq(financialEntries.direction, filters.direction) : undefined,
    filters.status ? eq(financialEntries.status, filters.status) : undefined,
    filters.category ? eq(financialEntries.category, filters.category) : undefined,
    filters.dueFrom ? gte(financialEntries.dueDate, filters.dueFrom) : undefined,
    filters.dueTo ? lt(financialEntries.dueDate, filters.dueTo) : undefined,
    pattern ? or(ilike(financialEntries.description, pattern), ilike(financialEntries.documentNumber, pattern)) : undefined,
  );
  const database = getDatabase();
  const [items, [{ total }]] = await Promise.all([
    database.select().from(financialEntries).where(where).orderBy(asc(financialEntries.dueDate), desc(financialEntries.createdAt)).limit(filters.pageSize).offset(filters.offset),
    database.select({ total: count() }).from(financialEntries).where(where),
  ]);
  return {
    items,
    total: Number(total),
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / filters.pageSize)),
  };
}

export async function listFinancialReportEntries(workshopId: string, filters: FinancialEntryFilters = {}) {
  const recognitionColumn = filters.recognitionMode === "cash" ? financialEntries.settledAt : financialEntries.competenceDate;
  const status = financialStatusValue(filters.status);
  return getDatabase().select({ id: financialEntries.id, externalId: financialEntries.externalId, direction: financialEntries.direction, category: financialEntries.category, description: financialEntries.description, grossAmountCents: financialEntries.grossAmountCents, feeAmountCents: financialEntries.feeAmountCents, netAmountCents: financialEntries.netAmountCents, competenceDate: financialEntries.competenceDate, dueDate: financialEntries.dueDate, settledAt: financialEntries.settledAt, status: financialEntries.status, paymentId: financialEntries.paymentId, paymentMethod: workOrderPayments.paymentMethod, collaboratorId: financialEntries.collaboratorId, collaboratorName: collaborators.name, serviceRecordId: financialEntries.serviceRecordId }).from(financialEntries).leftJoin(workOrderPayments, and(eq(workOrderPayments.id, financialEntries.paymentId), eq(workOrderPayments.workshopId, workshopId))).leftJoin(collaborators, and(eq(collaborators.id, financialEntries.collaboratorId), eq(collaborators.workshopId, workshopId))).where(and(eq(financialEntries.workshopId, workshopId), filters.from ? gte(recognitionColumn, filters.from) : undefined, filters.to ? lt(recognitionColumn, filters.to) : undefined, status ? eq(financialEntries.status, status) : undefined, filters.category ? eq(financialEntries.category, filters.category) : undefined, filters.paymentMethod ? eq(workOrderPayments.paymentMethod, filters.paymentMethod) : undefined, filters.collaboratorId ? eq(financialEntries.collaboratorId, filters.collaboratorId) : undefined)).orderBy(desc(financialEntries.competenceDate));
}

export function buildInstallmentEntryDrafts(input: {
  totalCents: number;
  installmentCount: number;
  firstDueDate: Date;
  groupId: string;
  idempotencyKey: string;
}) {
  return splitInstallments(input.totalCents, input.installmentCount, input.firstDueDate).map((installment) => ({
    ...installment,
    installmentGroupId: input.groupId,
    externalId: `manual:${input.idempotencyKey}:${installment.installmentNumber}`,
  }));
}

export async function createManualFinancialEntry(input: {
  workshopId: string;
  direction: "income" | "expense" | "reserve";
  category: string;
  description: string;
  amountCents: number;
  competenceDate: Date;
  dueDate: Date;
  settled: boolean;
  recurrenceKey?: string | null;
  installmentCount?: number;
  installmentGroupId?: string;
  idempotencyKey?: string;
  customerId?: string | null;
  supplierId?: string | null;
  financialAccountId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
}) {
  const installmentCount = input.installmentCount ?? 1;
  const groupId = input.installmentGroupId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const drafts = buildInstallmentEntryDrafts({ totalCents: input.amountCents, installmentCount, firstDueDate: input.dueDate, groupId, idempotencyKey });
  const now = new Date();
  return runDatabaseTransaction(async (tx) => {
    const rows = await tx.insert(financialEntries).values(drafts.map((draft) => ({
      workshopId: input.workshopId,
      externalId: draft.externalId,
      direction: input.direction,
      category: input.category,
      description: input.description,
      grossAmountCents: draft.amountCents,
      netAmountCents: draft.amountCents,
      competenceDate: input.competenceDate,
      dueDate: draft.dueDate,
      settledAt: input.settled ? now : null,
      status: input.settled ? "settled" as const : "expected" as const,
      recurrenceKey: input.recurrenceKey ?? null,
      installmentGroupId: draft.installmentGroupId,
      installmentNumber: draft.installmentNumber,
      installmentCount: draft.installmentCount,
      customerId: input.customerId ?? null,
      supplierId: input.supplierId ?? null,
      financialAccountId: input.financialAccountId ?? null,
      documentNumber: input.documentNumber ?? null,
      notes: input.notes ?? null,
    }))).onConflictDoNothing().returning();
    if (input.settled && rows.length) {
      await tx.insert(financialSettlements).values(rows.map((row) => ({ workshopId: input.workshopId, financialEntryId: row.id, financialAccountId: input.financialAccountId ?? null, amountCents: row.grossAmountCents, settledAt: now, note: "Lançamento criado como recebido/pago" })));
    }
    return installmentCount === 1 ? rows[0] : rows;
  });
}

export async function ensureDefaultFinancialAccount(workshopId: string) {
  const [account] = await getDatabase().insert(financialAccounts).values({ workshopId, name: "Caixa da oficina", type: "cash", systemDefault: true }).onConflictDoUpdate({ target: [financialAccounts.workshopId, financialAccounts.name], set: { active: true, systemDefault: true, updatedAt: new Date() } }).returning();
  return account;
}

export async function listFinancialAccounts(workshopId: string) {
  return getDatabase().select().from(financialAccounts).where(and(eq(financialAccounts.workshopId, workshopId), eq(financialAccounts.active, true))).orderBy(desc(financialAccounts.systemDefault), asc(financialAccounts.name));
}

export async function createFinancialAccount(input: { workshopId: string; name: string; type: string; openingBalanceCents?: number }) {
  const [row] = await getDatabase().insert(financialAccounts).values({ workshopId: input.workshopId, name: input.name.trim(), type: input.type, openingBalanceCents: input.openingBalanceCents ?? 0 }).returning();
  return row;
}

export async function listSuppliers(workshopId: string, search?: string) {
  const pattern = search?.trim() ? `%${search.trim()}%` : undefined;
  return getDatabase().select().from(suppliers).where(and(eq(suppliers.workshopId, workshopId), eq(suppliers.active, true), pattern ? or(ilike(suppliers.name, pattern), ilike(suppliers.document, pattern)) : undefined)).orderBy(asc(suppliers.name));
}

export async function createSupplier(input: { workshopId: string; name: string; document?: string | null; phone?: string | null; email?: string | null; notes?: string | null }) {
  const [row] = await getDatabase().insert(suppliers).values({ ...input, name: input.name.trim(), document: input.document?.trim() || null }).returning();
  return row;
}

export async function updateSupplier(input: { workshopId: string; supplierId: string; name: string; document?: string | null; phone?: string | null; email?: string | null; notes?: string | null; active?: boolean }) {
  const [row] = await getDatabase().update(suppliers).set({ name: input.name.trim(), document: input.document?.trim() || null, phone: input.phone ?? null, email: input.email ?? null, notes: input.notes ?? null, active: input.active ?? true, updatedAt: new Date() }).where(and(eq(suppliers.workshopId, input.workshopId), eq(suppliers.id, input.supplierId))).returning();
  if (!row) throw new Error("Fornecedor não encontrado.");
  return row;
}

export async function openCashSession(input: { workshopId: string; financialAccountId: string; openingBalanceCents: number; openedAt?: Date }) {
  return runDatabaseTransaction(async (tx) => {
    const [account] = await tx.select({ id: financialAccounts.id }).from(financialAccounts).where(and(eq(financialAccounts.workshopId, input.workshopId), eq(financialAccounts.id, input.financialAccountId), eq(financialAccounts.active, true))).limit(1);
    if (!account) throw new Error("Conta financeira não encontrada.");
    const [open] = await tx.select({ id: cashSessions.id }).from(cashSessions).where(and(eq(cashSessions.workshopId, input.workshopId), eq(cashSessions.financialAccountId, input.financialAccountId), sql`${cashSessions.closedAt} is null`)).limit(1);
    if (open) throw new Error("Já existe um caixa aberto para esta conta.");
    const [row] = await tx.insert(cashSessions).values({ ...input, openedAt: input.openedAt ?? new Date() }).returning();
    return row;
  });
}

export async function closeCashSession(input: { workshopId: string; cashSessionId: string; declaredClosingCents: number; note?: string | null; closedAt?: Date }) {
  return runDatabaseTransaction(async (tx) => {
    const [session] = await tx.select().from(cashSessions).where(and(eq(cashSessions.workshopId, input.workshopId), eq(cashSessions.id, input.cashSessionId), sql`${cashSessions.closedAt} is null`)).limit(1);
    if (!session) throw new Error("Caixa aberto não encontrado.");
    const [{ movementCents }] = await tx.select({ movementCents: sql<number>`coalesce(sum(case when ${financialEntries.direction} = 'income' then ${financialSettlements.amountCents} else -${financialSettlements.amountCents} end), 0)::integer` }).from(financialSettlements).innerJoin(financialEntries, and(eq(financialEntries.id, financialSettlements.financialEntryId), eq(financialEntries.workshopId, input.workshopId))).where(and(eq(financialSettlements.workshopId, input.workshopId), eq(financialSettlements.financialAccountId, session.financialAccountId), gte(financialSettlements.settledAt, session.openedAt), sql`${financialSettlements.reversedAt} is null`));
    const calculatedClosingCents = session.openingBalanceCents + Number(movementCents);
    const [row] = await tx.update(cashSessions).set({ closedAt: input.closedAt ?? new Date(), calculatedClosingCents, declaredClosingCents: input.declaredClosingCents, note: input.note ?? null, updatedAt: new Date() }).where(and(eq(cashSessions.workshopId, input.workshopId), eq(cashSessions.id, input.cashSessionId))).returning();
    return row;
  });
}

export async function listCashSessions(workshopId: string, limit = 30) {
  return getDatabase().select().from(cashSessions).where(eq(cashSessions.workshopId, workshopId)).orderBy(desc(cashSessions.openedAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function listFinancialSettlements(workshopId: string, financialEntryIds: string[]) {
  if (!financialEntryIds.length) return [];
  return getDatabase().select().from(financialSettlements).where(and(eq(financialSettlements.workshopId, workshopId), inArray(financialSettlements.financialEntryId, financialEntryIds))).orderBy(desc(financialSettlements.settledAt));
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

function databaseFinancialSettlementStore(tx: DatabaseTransaction): FinancialSettlementStore {
  return {
    async loadEntry(workshopId, financialEntryId) {
      const [entry] = await tx.select({ id: financialEntries.id, workshopId: financialEntries.workshopId, grossAmountCents: financialEntries.grossAmountCents, status: financialEntries.status }).from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).limit(1);
      return entry ?? null;
    },
    async listSettlements(workshopId, financialEntryId) {
      return tx.select({ id: financialSettlements.id, amountCents: financialSettlements.amountCents, reversedAt: financialSettlements.reversedAt }).from(financialSettlements).where(and(eq(financialSettlements.workshopId, workshopId), eq(financialSettlements.financialEntryId, financialEntryId))).orderBy(asc(financialSettlements.settledAt));
    },
    async createSettlement(input) {
      if (input.financialAccountId) {
        const [account] = await tx.select({ id: financialAccounts.id }).from(financialAccounts).where(and(eq(financialAccounts.workshopId, input.workshopId), eq(financialAccounts.id, input.financialAccountId), eq(financialAccounts.active, true))).limit(1);
        if (!account) throw new Error("Conta financeira não encontrada.");
      }
      const [row] = await tx.insert(financialSettlements).values({ workshopId: input.workshopId, financialEntryId: input.financialEntryId, amountCents: input.amountCents, feeAmountCents: input.feeAmountCents ?? 0, financialAccountId: input.financialAccountId ?? null, paymentMethod: input.paymentMethod ?? null, settledAt: input.settledAt, note: input.note ?? null }).returning({ id: financialSettlements.id, amountCents: financialSettlements.amountCents, reversedAt: financialSettlements.reversedAt });
      return row;
    },
    async reverseSettlement(workshopId, settlementId, reversedAt, note) {
      const rows = await tx.update(financialSettlements).set({ reversedAt, reversalNote: note ?? null, updatedAt: reversedAt }).where(and(eq(financialSettlements.workshopId, workshopId), eq(financialSettlements.id, settlementId), sql`${financialSettlements.reversedAt} is null`)).returning({ id: financialSettlements.id });
      if (!rows.length) throw new Error("Baixa financeira não encontrada.");
    },
    async updateEntryStatus(workshopId, financialEntryId, status, occurredAt) {
      const [current] = await tx.select({ status: financialEntries.status, paymentId: financialEntries.paymentId, serviceRecordId: financialEntries.serviceRecordId }).from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).limit(1);
      if (!current) throw new Error("Lançamento financeiro não encontrado.");
      await tx.update(financialEntries).set({ status, settledAt: status === "settled" ? occurredAt : null, updatedAt: occurredAt }).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId)));
      if (current.status !== status) await tx.insert(financialEntryEvents).values({ workshopId, financialEntryId, fromStatus: current.status, toStatus: status, occurredAt });
      if (current.paymentId) {
        const paid = status === "settled";
        await tx.update(workOrderPayments).set({ status: paid ? "paid" : "expected", paidAt: paid ? occurredAt : null, updatedAt: occurredAt }).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.id, current.paymentId)));
        const [taxEntry] = await tx.select({ id: financialEntries.id, status: financialEntries.status }).from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.paymentId, current.paymentId), eq(financialEntries.category, "tax_reserve"))).limit(1);
        if (taxEntry && taxEntry.status !== status) {
          await tx.update(financialEntries).set({ status, settledAt: paid ? occurredAt : null, updatedAt: occurredAt }).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, taxEntry.id)));
          await tx.insert(financialEntryEvents).values({ workshopId, financialEntryId: taxEntry.id, fromStatus: taxEntry.status, toStatus: status, occurredAt });
        }
        if (current.serviceRecordId) {
          const [outstanding] = await tx.select({ id: workOrderPayments.id }).from(workOrderPayments).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.serviceRecordId, current.serviceRecordId), eq(workOrderPayments.status, "expected"))).limit(1);
          await tx.update(serviceRecords).set({ paymentStatus: outstanding ? "pending" : "paid", updatedAt: occurredAt }).where(and(eq(serviceRecords.workshopId, workshopId), eq(serviceRecords.id, current.serviceRecordId)));
        }
      }
    },
  };
}

export async function settleFinancialEntry(input: { workshopId: string; financialEntryId: string; amountCents: number; settledAt?: Date; financialAccountId?: string | null; paymentMethod?: string | null; note?: string | null; feeAmountCents?: number }) {
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from financial_entries where workshop_id = ${input.workshopId} and id = ${input.financialEntryId} for update`);
    return applyFinancialSettlement(databaseFinancialSettlementStore(tx), { ...input, settledAt: input.settledAt ?? new Date() });
  });
}

export async function reverseFinancialEntrySettlement(input: { workshopId: string; financialEntryId: string; settlementId: string; reversedAt?: Date; note?: string | null }) {
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from financial_entries where workshop_id = ${input.workshopId} and id = ${input.financialEntryId} for update`);
    return reverseFinancialSettlement(databaseFinancialSettlementStore(tx), { ...input, reversedAt: input.reversedAt ?? new Date() });
  });
}

export async function setFinancialEntrySettlement(workshopId: string, financialEntryId: string, settle: boolean, now = new Date()) {
  if (settle) {
    return runDatabaseTransaction(async (tx) => {
      await tx.execute(sql`select id from financial_entries where workshop_id = ${workshopId} and id = ${financialEntryId} for update`);
      const store = databaseFinancialSettlementStore(tx);
      const entry = await store.loadEntry(workshopId, financialEntryId);
      if (!entry || entry.status === "cancelled") throw new Error("Lançamento financeiro não encontrado.");
      const balance = calculateEntryBalance(entry.grossAmountCents, await store.listSettlements(workshopId, financialEntryId));
      if (balance.balanceCents === 0) return entry;
      return applyFinancialSettlement(store, { workshopId, financialEntryId, amountCents: balance.balanceCents, settledAt: now });
    });
  }
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from financial_entries where workshop_id = ${workshopId} and id = ${financialEntryId} for update`);
    const [entry] = await tx.select().from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).limit(1);
    if (!entry || entry.status === "cancelled") throw new Error("Lançamento financeiro não encontrado.");
    const toStatus = "expected" as const;
    if (entry.status === toStatus) return entry;
    await tx.update(financialSettlements).set({ reversedAt: now, reversalNote: "Reabertura manual", updatedAt: now }).where(and(eq(financialSettlements.workshopId, workshopId), eq(financialSettlements.financialEntryId, financialEntryId), sql`${financialSettlements.reversedAt} is null`));
    const [updated] = await tx.update(financialEntries).set({ status: toStatus, settledAt: null, updatedAt: now }).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.id, financialEntryId))).returning();
    await tx.insert(financialEntryEvents).values({ workshopId, financialEntryId, fromStatus: entry.status, toStatus, occurredAt: now });
    if (entry.paymentId) {
      await tx.update(workOrderPayments).set({ status: "expected", paidAt: null, updatedAt: now }).where(and(eq(workOrderPayments.workshopId, workshopId), eq(workOrderPayments.id, entry.paymentId)));
      const linkedTaxEntries = await tx.select({ id: financialEntries.id, status: financialEntries.status }).from(financialEntries).where(and(eq(financialEntries.workshopId, workshopId), eq(financialEntries.paymentId, entry.paymentId), eq(financialEntries.category, "tax_reserve"), ne(financialEntries.status, toStatus)));
      if (linkedTaxEntries.length) {
        await tx.update(financialEntries).set({ status: toStatus, settledAt: null, updatedAt: now }).where(and(eq(financialEntries.workshopId, workshopId), inArray(financialEntries.id, linkedTaxEntries.map((tax) => tax.id))));
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
