import { and, eq, sql } from "drizzle-orm";
import { runDatabaseTransaction } from "../db/client";
import { financialEntries, inventoryItems, inventoryMovements, suppliers } from "../db/schema";
import { parseNfe } from "../domain/nfe";

export type InvoiceReview = { line: number; inventoryItemId: string | null; quantity: number; include: boolean };

export function validateInvoiceReview(xml: string, review: InvoiceReview[]) {
  const invoice = parseNfe(xml);
  if (review.length !== invoice.items.length || new Set(review.map((line) => line.line)).size !== review.length)
    throw new Error("Revise todos os itens da nota.");
  const items = invoice.items.flatMap((item) => {
    const selected = review.find((row) => row.line === item.line);
    if (!selected) throw new Error("Item da nota não revisado.");
    if (!selected.include) return [];
    if (!Number.isInteger(selected.quantity) || selected.quantity <= 0 || selected.quantity > 1000000) throw new Error("Informe a quantidade em unidades inteiras de estoque.");
    if (selected.inventoryItemId && !/^[0-9a-f-]{36}$/i.test(selected.inventoryItemId)) throw new Error("Produto de destino inválido.");
    return [{ ...item, inventoryItemId: selected.inventoryItemId || null, quantity: selected.quantity, unitCostCents: Math.round(item.totalCents / selected.quantity) }];
  });
  if (!items.length) throw new Error("Selecione pelo menos um produto.");
  return { ...invoice, items };
}

export function buildInvoiceFinancialDraft(invoice: ReturnType<typeof validateInvoiceReview>, dueDate: Date) {
  if (Number.isNaN(dueDate.getTime())) throw new Error("Informe um vencimento válido para a conta.");
  return {
    externalId: `nfe:${invoice.key}:payable`,
    supplierName: invoice.supplier,
    supplierDocument: invoice.supplierDocument || null,
    description: `Compra NF-e ${invoice.number} · ${invoice.supplier}`,
    documentNumber: invoice.number,
    amountCents: invoice.items.reduce((total, item) => total + item.totalCents, 0),
    dueDate,
  };
}

export async function importReviewedInvoice(workshopId: string, xml: string, review: InvoiceReview[], options: { createPayable?: boolean; dueDate?: Date } = {}) {
  const invoice = validateInvoiceReview(xml, review);
  return runDatabaseTransaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workshopId + invoice.key}))`);
    const prefix = `nfe:${invoice.key}:`;
    const [previous] = await tx.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.workshopId, workshopId), sql`${inventoryMovements.operationKey} like ${prefix + "%"}`)).limit(1);
    if (!previous) for (const item of invoice.items) {
      let itemId = item.inventoryItemId;
      if (!itemId) {
        const sku = `NF:${invoice.supplierDocument}:${item.code}`;
        const [product] = await tx.insert(inventoryItems).values({ workshopId, sku, name: item.name, unit: item.unit, costCents: item.unitCostCents, salePriceCents: 0, currentQuantity: 0, minimumQuantity: 0 }).onConflictDoUpdate({ target: [inventoryItems.workshopId, inventoryItems.sku], set: { costCents: item.unitCostCents, active: true } }).returning({ id: inventoryItems.id });
        itemId = product.id;
      }
      const [updated] = await tx.update(inventoryItems).set({ currentQuantity: sql`${inventoryItems.currentQuantity} + ${item.quantity}`, costCents: item.unitCostCents, updatedAt: new Date() }).where(and(eq(inventoryItems.workshopId, workshopId), eq(inventoryItems.id, itemId), eq(inventoryItems.active, true))).returning({ id: inventoryItems.id });
      if (!updated) throw new Error("Produto de destino não encontrado nesta oficina.");
      await tx.insert(inventoryMovements).values({ workshopId, inventoryItemId: itemId, type: "entry", quantityDelta: item.quantity, operationKey: `${prefix}${item.line}`, note: `NF-e ${invoice.number} · ${invoice.supplier} · ${invoice.key}` });
    }
    let payableCreated = false;
    if (options.createPayable) {
      const draft = buildInvoiceFinancialDraft(invoice, options.dueDate ?? new Date());
      let supplierId: string;
      if (draft.supplierDocument) {
        const [supplier] = await tx.insert(suppliers).values({ workshopId, name: draft.supplierName, document: draft.supplierDocument }).onConflictDoUpdate({ target: [suppliers.workshopId, suppliers.document], targetWhere: sql`${suppliers.document} is not null`, set: { name: draft.supplierName, active: true, updatedAt: new Date() } }).returning({ id: suppliers.id });
        supplierId = supplier.id;
      } else {
        const [existing] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.workshopId, workshopId), eq(suppliers.name, draft.supplierName))).limit(1);
        if (existing) supplierId = existing.id;
        else [{ id: supplierId }] = await tx.insert(suppliers).values({ workshopId, name: draft.supplierName }).returning({ id: suppliers.id });
      }
      const created = await tx.insert(financialEntries).values({ workshopId, supplierId, externalId: draft.externalId, direction: "expense", category: "parts_purchase", description: draft.description, grossAmountCents: draft.amountCents, netAmountCents: draft.amountCents, competenceDate: new Date(), dueDate: draft.dueDate, status: "expected", documentNumber: draft.documentNumber, notes: `Gerada automaticamente pela importação da NF-e ${invoice.key}` }).onConflictDoNothing().returning({ id: financialEntries.id });
      payableCreated = created.length > 0;
    }
    return { duplicate: Boolean(previous), imported: previous ? 0 : invoice.items.length, payableCreated };
  });
}
