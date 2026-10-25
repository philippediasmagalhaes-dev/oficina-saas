import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDatabase, runDatabaseTransaction } from "../db/client";
import { collaboratorServiceRates, collaborators, financialEntries, serviceCatalogItems, serviceRecords, workOrderItemAssignments, workOrderItems } from "../db/schema";
import { validateParticipationTotal, type CompensationMode } from "../domain/commissions";

export type AssignmentInput = { workshopId: string; workOrderItemId: string; collaboratorId: string; participationBasisPoints: number };

export type CollaboratorUpdateInput = {
  workshopId: string;
  collaboratorId: string;
  name: string;
  phone: string | null;
  compensationMode: CompensationMode;
  monthlyFixedCents: number;
  fixedPerServiceCents: number;
  commissionBasisPoints: number;
};

export interface CollaboratorAdminStore {
  update(input: CollaboratorUpdateInput): Promise<{ id: string } | null>;
  deactivate(workshopId: string, collaboratorId: string): Promise<boolean>;
  deleteRate(workshopId: string, rateId: string): Promise<boolean>;
}

export function createCollaboratorAdminService(store: CollaboratorAdminStore) {
  return {
    async update(input: CollaboratorUpdateInput) {
      const row = await store.update(input);
      if (!row) throw new Error("Colaborador não encontrado.");
      return row;
    },
    async deactivate(workshopId: string, collaboratorId: string) {
      if (!(await store.deactivate(workshopId, collaboratorId)))
        throw new Error("Colaborador não encontrado.");
    },
    async deleteRate(workshopId: string, rateId: string) {
      if (!(await store.deleteRate(workshopId, rateId)))
        throw new Error("Regra de remuneração não encontrada.");
    },
  };
}

export function createDrizzleCollaboratorAdminStore(): CollaboratorAdminStore {
  const database = getDatabase();
  return {
    async update(input) {
      const [row] = await database
        .update(collaborators)
        .set({
          name: input.name,
          phone: input.phone,
          compensationMode: input.compensationMode,
          monthlyFixedCents: input.monthlyFixedCents,
          fixedPerServiceCents: input.fixedPerServiceCents,
          commissionBasisPoints: input.commissionBasisPoints,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(collaborators.workshopId, input.workshopId),
            eq(collaborators.id, input.collaboratorId),
          ),
        )
        .returning({ id: collaborators.id });
      return row ?? null;
    },
    async deactivate(workshopId, collaboratorId) {
      const rows = await database
        .update(collaborators)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(collaborators.workshopId, workshopId),
            eq(collaborators.id, collaboratorId),
          ),
        )
        .returning({ id: collaborators.id });
      return rows.length > 0;
    },
    async deleteRate(workshopId, rateId) {
      const rows = await database
        .delete(collaboratorServiceRates)
        .where(
          and(
            eq(collaboratorServiceRates.workshopId, workshopId),
            eq(collaboratorServiceRates.id, rateId),
          ),
        )
        .returning({ id: collaboratorServiceRates.id });
      return rows.length > 0;
    },
  };
}

export async function updateCollaborator(input: CollaboratorUpdateInput) {
  return createCollaboratorAdminService(createDrizzleCollaboratorAdminStore()).update(input);
}

export async function deactivateCollaborator(workshopId: string, collaboratorId: string) {
  return createCollaboratorAdminService(createDrizzleCollaboratorAdminStore()).deactivate(workshopId, collaboratorId);
}

export async function deleteCollaboratorServiceRate(workshopId: string, rateId: string) {
  return createCollaboratorAdminService(createDrizzleCollaboratorAdminStore()).deleteRate(workshopId, rateId);
}

export type CollaboratorPayableEntry = {
  collaboratorId: string;
  collaboratorName: string;
  category: string;
  status: string;
  amountCents: number;
};

export function summarizeCollaboratorPayables(entries: CollaboratorPayableEntry[]) {
  const summaries = new Map<string, {
    collaboratorId: string;
    collaboratorName: string;
    commissionCents: number;
    fixedCents: number;
    settledCents: number;
    pendingCents: number;
    totalCents: number;
  }>();
  for (const entry of entries) {
    if (entry.status === "cancelled") continue;
    const summary = summaries.get(entry.collaboratorId) ?? {
      collaboratorId: entry.collaboratorId,
      collaboratorName: entry.collaboratorName,
      commissionCents: 0,
      fixedCents: 0,
      settledCents: 0,
      pendingCents: 0,
      totalCents: 0,
    };
    if (entry.category === "labor_compensation") summary.commissionCents += entry.amountCents;
    if (entry.category === "fixed_payroll") summary.fixedCents += entry.amountCents;
    if (entry.status === "settled") summary.settledCents += entry.amountCents;
    else summary.pendingCents += entry.amountCents;
    summary.totalCents += entry.amountCents;
    summaries.set(entry.collaboratorId, summary);
  }
  return [...summaries.values()].sort((a, b) =>
    a.collaboratorName.localeCompare(b.collaboratorName, "pt-BR"),
  );
}

export async function listCollaboratorPayables(
  workshopId: string,
  period: { from: Date; to: Date },
) {
  const rows = await getDatabase()
    .select({
      collaboratorId: collaborators.id,
      collaboratorName: collaborators.name,
      category: financialEntries.category,
      status: financialEntries.status,
      amountCents: financialEntries.netAmountCents,
    })
    .from(financialEntries)
    .innerJoin(
      collaborators,
      and(
        eq(collaborators.id, financialEntries.collaboratorId),
        eq(collaborators.workshopId, workshopId),
      ),
    )
    .where(
      and(
        eq(financialEntries.workshopId, workshopId),
        inArray(financialEntries.category, ["labor_compensation", "fixed_payroll"]),
        gte(financialEntries.competenceDate, period.from),
        lt(financialEntries.competenceDate, period.to),
      ),
    );
  return summarizeCollaboratorPayables(rows);
}

export interface CollaboratorAssignmentStore {
  getLaborItem(workshopId: string, workOrderItemId: string): Promise<{ id: string; type: "service" | "part"; financialClosedAt: Date | null } | null>;
  listParticipation(workshopId: string, workOrderItemId: string, excludedCollaboratorId: string): Promise<number[]>;
  save(input: AssignmentInput): Promise<{ id: string }>;
}

export async function assignCollaborator(store: CollaboratorAssignmentStore, input: AssignmentInput) {
  const item = await store.getLaborItem(input.workshopId, input.workOrderItemId);
  if (!item || item.type !== "service") throw new Error("Colaboradores só podem ser atribuídos à mão de obra.");
  if (item.financialClosedAt) throw new Error("A remuneração desta OS já foi fechada.");
  const existing = await store.listParticipation(input.workshopId, input.workOrderItemId, input.collaboratorId);
  validateParticipationTotal([...existing, input.participationBasisPoints]);
  return store.save(input);
}

export function createDrizzleAssignmentStore(): CollaboratorAssignmentStore {
  const database = getDatabase();
  return {
    async getLaborItem(workshopId, workOrderItemId) {
      const [row] = await database.select({ id: workOrderItems.id, type: workOrderItems.type, financialClosedAt: serviceRecords.financialClosedAt }).from(workOrderItems).innerJoin(serviceRecords, and(eq(serviceRecords.id, workOrderItems.serviceRecordId), eq(serviceRecords.workshopId, workshopId))).where(and(eq(workOrderItems.workshopId, workshopId), eq(workOrderItems.id, workOrderItemId))).limit(1);
      return row ?? null;
    },
    async listParticipation(workshopId, workOrderItemId, excludedCollaboratorId) {
      const rows = await database.select({ collaboratorId: workOrderItemAssignments.collaboratorId, value: workOrderItemAssignments.participationBasisPoints }).from(workOrderItemAssignments).where(and(eq(workOrderItemAssignments.workshopId, workshopId), eq(workOrderItemAssignments.workOrderItemId, workOrderItemId)));
      return rows.filter((row) => row.collaboratorId !== excludedCollaboratorId).map((row) => row.value);
    },
    async save(input) {
      const [collaborator] = await database.select({ id: collaborators.id }).from(collaborators).where(and(eq(collaborators.workshopId, input.workshopId), eq(collaborators.id, input.collaboratorId), eq(collaborators.active, true))).limit(1);
      if (!collaborator) throw new Error("Colaborador não encontrado.");
      const [row] = await database.insert(workOrderItemAssignments).values(input).onConflictDoUpdate({
        target: [workOrderItemAssignments.workOrderItemId, workOrderItemAssignments.collaboratorId],
        set: { participationBasisPoints: input.participationBasisPoints, updatedAt: new Date() },
      }).returning({ id: workOrderItemAssignments.id });
      return row;
    },
  };
}

export async function assignWorkOrderItem(input: AssignmentInput) {
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select id from work_order_items where workshop_id = ${input.workshopId} and id = ${input.workOrderItemId} for update`);
    const [item] = await tx.select({ id: workOrderItems.id, type: workOrderItems.type, financialClosedAt: serviceRecords.financialClosedAt }).from(workOrderItems).innerJoin(serviceRecords, and(eq(serviceRecords.id, workOrderItems.serviceRecordId), eq(serviceRecords.workshopId, input.workshopId))).where(and(eq(workOrderItems.workshopId, input.workshopId), eq(workOrderItems.id, input.workOrderItemId))).limit(1);
    if (!item || item.type !== "service") throw new Error("Colaboradores só podem ser atribuídos à mão de obra.");
    if (item.financialClosedAt) throw new Error("A remuneração desta OS já foi fechada.");
    const [collaborator, existing] = await Promise.all([
      tx.select({ id: collaborators.id }).from(collaborators).where(and(eq(collaborators.workshopId, input.workshopId), eq(collaborators.id, input.collaboratorId), eq(collaborators.active, true))).limit(1),
      tx.select({ collaboratorId: workOrderItemAssignments.collaboratorId, value: workOrderItemAssignments.participationBasisPoints }).from(workOrderItemAssignments).where(and(eq(workOrderItemAssignments.workshopId, input.workshopId), eq(workOrderItemAssignments.workOrderItemId, input.workOrderItemId))),
    ]);
    if (!collaborator[0]) throw new Error("Colaborador não encontrado.");
    validateParticipationTotal([...existing.filter((row) => row.collaboratorId !== input.collaboratorId).map((row) => row.value), input.participationBasisPoints]);
    const [row] = await tx.insert(workOrderItemAssignments).values(input).onConflictDoUpdate({ target: [workOrderItemAssignments.workOrderItemId, workOrderItemAssignments.collaboratorId], set: { participationBasisPoints: input.participationBasisPoints, updatedAt: new Date() } }).returning({ id: workOrderItemAssignments.id });
    return row;
  });
}

export async function listCollaborators(workshopId: string) {
  return getDatabase().select().from(collaborators).where(eq(collaborators.workshopId, workshopId)).orderBy(collaborators.name);
}

export async function createCollaborator(input: { workshopId: string; name: string; phone: string | null; compensationMode: CompensationMode; monthlyFixedCents: number; fixedPerServiceCents: number; commissionBasisPoints: number }) {
  const [row] = await getDatabase().insert(collaborators).values(input).returning();
  return row;
}

export async function setCollaboratorServiceRate(input: { workshopId: string; collaboratorId: string; serviceCatalogId: string; fixedPerServiceCents: number | null; commissionBasisPoints: number | null }) {
  const [row] = await getDatabase().insert(collaboratorServiceRates).values(input).onConflictDoUpdate({
    target: [collaboratorServiceRates.workshopId, collaboratorServiceRates.collaboratorId, collaboratorServiceRates.serviceCatalogId],
    set: { fixedPerServiceCents: input.fixedPerServiceCents, commissionBasisPoints: input.commissionBasisPoints, updatedAt: new Date() },
  }).returning();
  return row;
}

export async function listCollaboratorRates(workshopId: string) {
  return getDatabase().select({ id: collaboratorServiceRates.id, collaboratorId: collaboratorServiceRates.collaboratorId, serviceCatalogId: collaboratorServiceRates.serviceCatalogId, serviceName: serviceCatalogItems.name, fixedPerServiceCents: collaboratorServiceRates.fixedPerServiceCents, commissionBasisPoints: collaboratorServiceRates.commissionBasisPoints }).from(collaboratorServiceRates).innerJoin(serviceCatalogItems, and(eq(serviceCatalogItems.id, collaboratorServiceRates.serviceCatalogId), eq(serviceCatalogItems.workshopId, workshopId))).where(eq(collaboratorServiceRates.workshopId, workshopId));
}

export async function listWorkOrderAssignments(workshopId: string, serviceRecordId: string) {
  return getDatabase().select({ id: workOrderItemAssignments.id, workOrderItemId: workOrderItemAssignments.workOrderItemId, collaboratorId: workOrderItemAssignments.collaboratorId, collaboratorName: collaborators.name, participationBasisPoints: workOrderItemAssignments.participationBasisPoints, compensationCentsSnapshot: workOrderItemAssignments.compensationCentsSnapshot }).from(workOrderItemAssignments).innerJoin(workOrderItems, and(eq(workOrderItems.id, workOrderItemAssignments.workOrderItemId), eq(workOrderItems.workshopId, workshopId))).innerJoin(collaborators, and(eq(collaborators.id, workOrderItemAssignments.collaboratorId), eq(collaborators.workshopId, workshopId))).where(and(eq(workOrderItemAssignments.workshopId, workshopId), eq(workOrderItems.serviceRecordId, serviceRecordId)));
}

export async function removeWorkOrderAssignment(workshopId: string, assignmentId: string) {
  await runDatabaseTransaction(async (tx) => {
    const [assignment] = await tx.select({ id: workOrderItemAssignments.id, workOrderItemId: workOrderItemAssignments.workOrderItemId, financialClosedAt: serviceRecords.financialClosedAt }).from(workOrderItemAssignments).innerJoin(workOrderItems, and(eq(workOrderItems.id, workOrderItemAssignments.workOrderItemId), eq(workOrderItems.workshopId, workshopId))).innerJoin(serviceRecords, and(eq(serviceRecords.id, workOrderItems.serviceRecordId), eq(serviceRecords.workshopId, workshopId))).where(and(eq(workOrderItemAssignments.workshopId, workshopId), eq(workOrderItemAssignments.id, assignmentId))).limit(1);
    if (!assignment) throw new Error("Atribuição não encontrada.");
    await tx.execute(sql`select id from work_order_items where workshop_id = ${workshopId} and id = ${assignment.workOrderItemId} for update`);
    if (assignment.financialClosedAt) throw new Error("A remuneração desta OS já foi fechada.");
    await tx.delete(workOrderItemAssignments).where(and(eq(workOrderItemAssignments.workshopId, workshopId), eq(workOrderItemAssignments.id, assignmentId)));
  });
}
