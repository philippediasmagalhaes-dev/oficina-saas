"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildQuoteDraft, buildServiceReadyDraft, buildWhatsAppDraft } from "../domain/outreach";
import { deriveNextDueAt } from "../domain/forecast";
import { parseCurrencyToCents } from "../domain/money";
import { canTransitionWorkOrder } from "../domain/work-orders";
import { normalizeBrazilianPhone } from "../domain/workshop-settings";
import { createCrmService } from "../server/crm-service";
import { createDrizzleRepository } from "../server/drizzle-repository";
import { getOwnerContext, getOwnerUser } from "../server/owner-context";
import { updateVehicle } from "../server/vehicles";
import { saveInspection } from "../server/inspections";
import { assignWorkOrderItem, createCollaborator, deactivateCollaborator, deleteCollaboratorServiceRate, removeWorkOrderAssignment, setCollaboratorServiceRate, updateCollaborator } from "../server/collaborators";
import { closeCashSession, createFinancialAccount, createManualFinancialEntry, createSupplier, deactivatePaymentFeeRule, openCashSession, reverseFinancialEntrySettlement, saveFinancialSettings, savePaymentFeeRule, setFinancialEntrySettlement, settleFinancialEntry, updateSupplier } from "../server/finance";
import { createFinancialCategory, deactivateFinancialCategory, listFinancialCategories, updateFinancialCategory } from "../server/financial-categories";
import { seedAutomotiveCatalog, updateCatalogMaintenance } from "../server/automotive-catalog";
import { confirmExistingWhatsAppConsent } from "../server/retention";
import { importReviewedInvoice, type InvoiceReview } from "../server/nfe-intake";
import { enqueueVehicleReadyMessage, normalizeReadyRecipient } from "../server/whatsapp";
import {
  addQuoteItem,
  addServicePhoto,
  createWorkOrder,
  finalizeWorkOrder,
  getWorkOrder,
  removeQuoteItem,
  reopenApprovedQuote,
  recordOfflineQuoteDecision,
  respondToQuote,
  saveDiagnosis,
  sendQuote,
  updateWorkOrderStatus,
} from "../server/work-orders";
import {
  customerSchema,
  collaboratorRateSchema,
  collaboratorRateIdSchema,
  collaboratorSchema,
  collaboratorIdSchema,
  collaboratorUpdateSchema,
  assignmentSchema,
  diagnosisSchema,
  finalizationSchema,
  financialSettingsSchema,
  financialCategorySchema,
  financialCategoryUpdateSchema,
  financialCategoryIdSchema,
  manualFinancialEntrySchema,
  financialSettlementSchema,
  financialSettlementReversalSchema,
  financialAccountSchema,
  supplierSchema,
  cashSessionOpenSchema,
  cashSessionCloseSchema,
  paymentFeeRuleSchema,
  paymentFeeRuleIdSchema,
  inventoryAdjustmentSchema,
  inventoryItemSchema,
  photoSchema,
  quoteItemSchema,
  quoteSettingsSchema,
  serviceCatalogSchema,
  serviceSchema,
  vehicleSchema,
  vehicleUpdateSchema,
  workOrderSchema,
  workOrderStatusSchema,
  workshopSchema,
  workshopSettingsSchema,
} from "../server/validators";

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function parse<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new Error("Revise os campos informados.");
  return result.data;
}

export async function importInvoiceAction(xml: string, review: InvoiceReview[], options: { createPayable?: boolean; dueDate?: string } = {}) {
  const { workshopId } = await getOwnerContext();
  const dueDate = options.createPayable ? new Date(`${options.dueDate ?? ""}T00:00:00.000Z`) : undefined;
  if (options.createPayable && (!dueDate || Number.isNaN(dueDate.getTime()))) throw new Error("Informe o vencimento da conta a pagar.");
  const result = await importReviewedInvoice(workshopId, xml, review, { createPayable: Boolean(options.createPayable), dueDate });
  revalidatePath("/estoque"); revalidatePath("/financeiro"); revalidatePath("/financeiro/pagar"); revalidatePath("/");
  return result;
}

export async function createWorkshopAction(formData: FormData) {
  const user = await getOwnerUser();
  const input = parse(workshopSchema.safeParse(formObject(formData)));
  const repository = createDrizzleRepository();
  const existing = await repository.getWorkshopForUser(user.id);
  if (!existing)
    await repository.createWorkshop({ ownerUserId: user.id, ...input });
  redirect("/");
}

export async function createCustomerAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(customerSchema.safeParse(formObject(formData)));
  await repository.createCustomer({ workshopId, ...input });
  revalidatePath("/clientes");
  revalidatePath("/");
}

export async function updateWorkshopSettingsAction(formData: FormData) {
  const { workshop, repository } = await getOwnerContext();
  const input = parse(workshopSettingsSchema.safeParse(formObject(formData)));
  const updated = await repository.updateWorkshop({ ...workshop, ...input });
  if (!updated) throw new Error("Oficina não encontrada.");
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

export async function createCollaboratorAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(collaboratorSchema.safeParse(formObject(formData)));
  await createCollaborator({ workshopId, name: input.name, phone: input.phone, compensationMode: input.compensationMode, monthlyFixedCents: parseCurrencyToCents(input.monthlyFixed), fixedPerServiceCents: parseCurrencyToCents(input.fixedPerService), commissionBasisPoints: Math.round(input.commissionPercent * 100) });
  revalidatePath("/colaboradores");
}

export async function setCollaboratorServiceRateAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(collaboratorRateSchema.safeParse(formObject(formData)));
  await setCollaboratorServiceRate({ workshopId, collaboratorId: input.collaboratorId, serviceCatalogId: input.serviceCatalogId, fixedPerServiceCents: input.fixedPerService ? parseCurrencyToCents(input.fixedPerService) : null, commissionBasisPoints: input.commissionPercent === null ? null : Math.round(input.commissionPercent * 100) });
  revalidatePath("/colaboradores");
}

export async function updateCollaboratorAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(collaboratorUpdateSchema.safeParse(formObject(formData)));
  await updateCollaborator({
    workshopId,
    collaboratorId: input.collaboratorId,
    name: input.name,
    phone: input.phone,
    compensationMode: input.compensationMode,
    monthlyFixedCents: parseCurrencyToCents(input.monthlyFixed),
    fixedPerServiceCents: parseCurrencyToCents(input.fixedPerService),
    commissionBasisPoints: Math.round(input.commissionPercent * 100),
  });
  revalidatePath("/colaboradores");
  revalidatePath("/financeiro");
}

export async function deactivateCollaboratorAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(collaboratorIdSchema.safeParse(formObject(formData)));
  await deactivateCollaborator(workshopId, input.collaboratorId);
  revalidatePath("/colaboradores");
  revalidatePath("/financeiro");
}

export async function deleteCollaboratorServiceRateAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(collaboratorRateIdSchema.safeParse(formObject(formData)));
  await deleteCollaboratorServiceRate(workshopId, input.rateId);
  revalidatePath("/colaboradores");
}

export async function assignCollaboratorAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(assignmentSchema.safeParse(formObject(formData)));
  await assignWorkOrderItem({ workshopId, workOrderItemId: input.workOrderItemId, collaboratorId: input.collaboratorId, participationBasisPoints: Math.round(input.participationPercent * 100) });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
}

export async function removeCollaboratorAssignmentAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  await removeWorkOrderAssignment(workshopId, assignmentId);
  revalidatePath(`/ordens/${serviceRecordId}`);
}

export async function setFinancialEntrySettlementAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const financialEntryId = String(formData.get("financialEntryId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(financialEntryId) || !["settle", "reopen"].includes(decision)) throw new Error("Baixa financeira inválida.");
  await setFinancialEntrySettlement(workshopId, financialEntryId, decision === "settle");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro/caixa");
  revalidatePath("/financeiro/relatorios");
  revalidatePath("/");
}

export async function settleFinancialEntryAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialSettlementSchema.safeParse(formObject(formData)));
  await settleFinancialEntry({ workshopId, financialEntryId: input.financialEntryId, amountCents: parseCurrencyToCents(input.amount), feeAmountCents: parseCurrencyToCents(input.feeAmount), financialAccountId: input.financialAccountId, paymentMethod: input.paymentMethod, note: input.note });
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function reverseFinancialEntrySettlementAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialSettlementReversalSchema.safeParse(formObject(formData)));
  await reverseFinancialEntrySettlement({ workshopId, ...input });
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function updateCustomerAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const customerId = String(formData.get("customerId") ?? "");
  const input = parse(customerSchema.safeParse(formObject(formData)));
  const customer = await repository.updateCustomer({
    workshopId,
    customerId,
    ...input,
    phoneNormalized: input.phone ? normalizeBrazilianPhone(input.phone) : null,
  });
  if (!customer) throw new Error("Cliente não encontrado.");
  revalidatePath("/clientes");
  revalidatePath("/servicos");
  revalidatePath("/retencao");
  revalidatePath("/financeiro");
  revalidatePath("/");
  redirect("/clientes");
}

export async function createVehicleAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(vehicleSchema.safeParse(formObject(formData)));
  if (!(await repository.findCustomer(workshopId, input.customerId)))
    throw new Error("Registro não encontrado");
  await repository.createVehicle({ workshopId, ...input, year: input.year ?? input.modelYear, lookupAt: input.lookupProvider ? new Date() : null });
  revalidatePath("/clientes");
  revalidatePath("/veiculos");
}

export async function updateVehicleAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(vehicleUpdateSchema.safeParse(formObject(formData)));
  const vehicle = await updateVehicle({ workshopId, ...input, year: input.year ?? input.modelYear, lookupAt: input.lookupProvider ? new Date() : null });
  if (!vehicle) throw new Error("Veículo não encontrado.");
  revalidatePath("/veiculos");
  revalidatePath(`/veiculos/${input.vehicleId}`);
  redirect(`/veiculos/${input.vehicleId}`);
}

export async function createWorkOrderAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(workOrderSchema.safeParse(formObject(formData)));
  const order = await createWorkOrder({ workshopId, ...input });
  revalidatePath("/ordens");
  revalidatePath("/");
  redirect(`/ordens/${order.id}`);
}

export async function saveDiagnosisAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(diagnosisSchema.safeParse(formObject(formData)));
  await saveDiagnosis({ workshopId, ...input });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function saveInspectionAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  const odometerValue = String(formData.get("inspectionOdometer") ?? "").trim();
  const checklistKeys = ["frontPanel", "antenna", "speakers", "spareKey", "towHook", "jack", "extinguisher", "spareTire", "wheelKey", "documents"];
  let marks: unknown = [];
  try { marks = JSON.parse(String(formData.get("damageMarks") ?? "[]")); } catch { throw new Error("Mapa de avarias inválido."); }
  await saveInspection({
    workshopId,
    serviceRecordId,
    odometer: odometerValue ? Number(odometerValue) : null,
    fuelLevel: String(formData.get("fuelLevel") ?? "") || null,
    tireCondition: String(formData.get("tireCondition") ?? "") || null,
    checklist: Object.fromEntries(checklistKeys.map((key) => [key, formData.get(`check_${key}`) === "on"])),
    observations: String(formData.get("inspectionObservations") ?? "").trim() || null,
    marks: Array.isArray(marks) ? marks as Parameters<typeof saveInspection>[0]["marks"] : [],
  });
  revalidatePath(`/ordens/${serviceRecordId}`);
}

export async function reopenApprovedQuoteAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  await reopenApprovedQuote(workshopId, serviceRecordId);
  revalidatePath(`/ordens/${serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function addQuoteItemAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(quoteItemSchema.safeParse(formObject(formData)));
  await addQuoteItem({
    workshopId,
    ...input,
    unitPriceCents: parseCurrencyToCents(input.unitPrice),
  });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
}

export async function removeQuoteItemAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await removeQuoteItem(workshopId, serviceRecordId, itemId);
  revalidatePath(`/ordens/${serviceRecordId}`);
}

export async function publishQuoteAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(quoteSettingsSchema.safeParse(formObject(formData)));
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  validUntil?.setUTCHours(23, 59, 59, 999);
  await sendQuote({
    workshopId,
    serviceRecordId: input.serviceRecordId,
    discountCents: parseCurrencyToCents(input.discount),
    validUntil,
  });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function shareQuoteWhatsAppAction(formData: FormData) {
  const { workshop, workshopId, repository } = await getOwnerContext();
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  const order = await getWorkOrder(workshopId, serviceRecordId);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  const quoteUrl = new URL(`/orcamento/${order.quoteToken}`, process.env.BETTER_AUTH_URL).toString();
  const draft = buildQuoteDraft({
    phone: order.customerPhone,
    consent: order.customerWhatsappConsent,
    customer: order.customerName,
    workshop: workshop.name,
    vehicle: order.vehicleLabel,
    total: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.amountCents / 100),
    quoteUrl,
  });
  if (!draft) throw new Error("Cliente sem telefone válido ou consentimento para WhatsApp.");
  await repository.recordContact({ workshopId, customerId: order.customerId, reason: "Orçamento digital", message: draft.message });
  redirect(draft.url);
}

export async function respondToQuoteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "") as "approved" | "rejected";
  if (response !== "approved" && response !== "rejected") throw new Error("Resposta inválida.");
  const order = await respondToQuote(token, response);
  if (!order) throw new Error("Orçamento não encontrado.");
  revalidatePath(`/orcamento/${token}`);
  revalidatePath(`/ordens/${order.id}`);
  revalidatePath("/ordens");
  redirect(`/orcamento/${token}?resposta=${response}`);
}

export async function recordOfflineQuoteDecisionAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const serviceRecordId = String(formData.get("serviceRecordId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(serviceRecordId) || (decision !== "approved" && decision !== "rejected")) throw new Error("Decisão inválida.");
  await recordOfflineQuoteDecision(workshopId, serviceRecordId, decision);
  revalidatePath(`/ordens/${serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function updateWorkOrderStatusAction(formData: FormData) {
  const { workshop, workshopId } = await getOwnerContext();
  const input = parse(workOrderStatusSchema.safeParse(formObject(formData)));
  const order = await getWorkOrder(workshopId, input.serviceRecordId);
  if (!order || !canTransitionWorkOrder(order.status, input.status)) throw new Error("Mudança de status não permitida.");
  await updateWorkOrderStatus(workshopId, input.serviceRecordId, input.status);
  if (input.status === "ready") {
    const recipientPhone = normalizeReadyRecipient({
      consent: order.customerWhatsappConsent,
      phone: order.customerPhone,
    });
    if (recipientPhone) {
      try {
        await enqueueVehicleReadyMessage({
          workshopId,
          customerId: order.customerId,
          serviceRecordId: order.id,
          recipientPhone,
          customerName: order.customerName,
          workshopName: workshop.name,
          vehicleLabel: order.vehicleLabel,
        });
      } catch (error) {
        console.error("Falha ao programar aviso de veículo pronto.", error);
      }
    }
  }
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function finalizeWorkOrderAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(finalizationSchema.safeParse(formObject(formData)));
  await finalizeWorkOrder({
    workshopId,
    ...input,
    payments: input.payments.map((payment) => ({ paymentMethod: payment.paymentMethod, amountCents: parseCurrencyToCents(payment.amount), installmentCount: payment.installmentCount, paid: payment.paid, expectedAt: payment.expectedAt, manualFeeCents: payment.manualFee ? parseCurrencyToCents(payment.manualFee) : null })),
    taxBasisPoints: Math.round(input.taxPercent * 100),
    nextDueAt: input.nextDueAt ?? deriveNextDueAt(new Date(), input.returnIntervalDays),
  });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
  revalidatePath("/veiculos");
  revalidatePath("/financeiro");
  revalidatePath("/retencao");
  revalidatePath("/estoque");
  revalidatePath("/");
}

export async function saveFinancialSettingsAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialSettingsSchema.safeParse(formObject(formData)));
  await saveFinancialSettings({ workshopId, defaultTaxBasisPoints: Math.round(input.defaultTaxPercent * 100), defaultRecognitionMode: input.defaultRecognitionMode });
  revalidatePath("/configuracoes");
  revalidatePath("/financeiro");
}

export async function savePaymentFeeRuleAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(paymentFeeRuleSchema.safeParse(formObject(formData)));
  await savePaymentFeeRule({ workshopId, paymentMethod: input.paymentMethod, installmentCount: input.installmentCount, percentageBasisPoints: Math.round(input.percentage * 100), fixedFeeCents: parseCurrencyToCents(input.fixedFee) });
  revalidatePath("/configuracoes");
}

export async function deactivatePaymentFeeRuleAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(paymentFeeRuleIdSchema.safeParse(formObject(formData)));
  await deactivatePaymentFeeRule(workshopId, input.ruleId);
  revalidatePath("/configuracoes");
  revalidatePath("/financeiro");
}

export async function createFinancialCategoryAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialCategorySchema.safeParse(formObject(formData)));
  await createFinancialCategory({ workshopId, ...input });
  revalidatePath("/financeiro");
}

export async function updateFinancialCategoryAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialCategoryUpdateSchema.safeParse(formObject(formData)));
  await updateFinancialCategory({ workshopId, ...input });
  revalidatePath("/financeiro");
}

export async function deactivateFinancialCategoryAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialCategoryIdSchema.safeParse(formObject(formData)));
  await deactivateFinancialCategory(workshopId, input.categoryId);
  revalidatePath("/financeiro");
}

export async function createManualFinancialEntryAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(manualFinancialEntrySchema.safeParse(formObject(formData)));
  const categories = await listFinancialCategories(workshopId);
  if (!categories.some((category) => category.key === input.category && category.active && !category.protected && category.direction === input.direction)) throw new Error("Escolha uma categoria ativa correspondente ao tipo de lançamento.");
  await createManualFinancialEntry({ workshopId, direction: input.direction, category: input.category, description: input.description, amountCents: parseCurrencyToCents(input.amount), competenceDate: input.competenceDate, dueDate: input.dueDate, settled: input.settled, recurrenceKey: input.recurringMonthly ? `monthly:${crypto.randomUUID()}` : null, installmentCount: input.installmentCount, supplierId: input.supplierId, financialAccountId: input.financialAccountId, documentNumber: input.documentNumber, notes: input.notes });
  revalidatePath("/financeiro");
}

export async function createFinancialAccountAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(financialAccountSchema.safeParse(formObject(formData)));
  await createFinancialAccount({ workshopId, name: input.name, type: input.type, openingBalanceCents: parseCurrencyToCents(input.openingBalance) });
  revalidatePath("/financeiro");
}

export async function saveSupplierAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(supplierSchema.safeParse(formObject(formData)));
  if (input.supplierId) await updateSupplier({ workshopId, supplierId: input.supplierId, name: input.name, document: input.document, phone: input.phone, email: input.email, notes: input.notes });
  else await createSupplier({ workshopId, name: input.name, document: input.document, phone: input.phone, email: input.email, notes: input.notes });
  revalidatePath("/financeiro");
}

export async function openCashSessionAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(cashSessionOpenSchema.safeParse(formObject(formData)));
  await openCashSession({ workshopId, financialAccountId: input.financialAccountId, openingBalanceCents: parseCurrencyToCents(input.openingBalance) });
  revalidatePath("/financeiro");
}

export async function closeCashSessionAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(cashSessionCloseSchema.safeParse(formObject(formData)));
  await closeCashSession({ workshopId, cashSessionId: input.cashSessionId, declaredClosingCents: parseCurrencyToCents(input.declaredClosing), note: input.note });
  revalidatePath("/financeiro");
}

export async function uploadServicePhotoAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(photoSchema.safeParse(formObject(formData)));
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  if (file.size > 2_000_000) throw new Error("A foto deve ter no máximo 2 MB.");
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  const body = new Uint8Array(await file.arrayBuffer());
  await addServicePhoto({ workshopId, serviceRecordId: input.serviceRecordId, kind: input.kind, caption: input.caption, fileName: file.name, mimeType: file.type, body });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
}

export async function recordServiceAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const raw = formObject(formData) as Record<string, FormDataEntryValue>;
  const inventoryItemId = String(raw.inventoryItemId ?? "");
  const quantity = Number(raw.inventoryQuantity ?? 0);
  const input = parse(
    serviceSchema.safeParse({
      ...raw,
      inventory:
        inventoryItemId && quantity > 0 ? [{ inventoryItemId, quantity }] : [],
    }),
  );
  await createCrmService(repository).recordService({
    workshopId,
    ...input,
    description: "",
    amountCents: parseCurrencyToCents(input.amount),
    nextDueAt:
      input.nextDueAt ??
      deriveNextDueAt(input.completedAt, input.returnIntervalDays),
  });
  revalidatePath("/servicos");
  revalidatePath("/retencao");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function createServiceCatalogAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(serviceCatalogSchema.safeParse(formObject(formData)));
  await repository.createServiceCatalogItem({
    workshopId,
    name: input.name,
    defaultPriceCents: parseCurrencyToCents(input.defaultPrice),
    defaultReturnIntervalDays: input.defaultReturnIntervalDays,
    defaultReturnIntervalKm: input.defaultReturnIntervalKm,
  });
  revalidatePath("/servicos");
  revalidatePath("/financeiro");
}

export async function seedAutomotiveCatalogAction() {
  const { workshopId } = await getOwnerContext();
  await seedAutomotiveCatalog(workshopId);
  revalidatePath("/servicos");
}

export async function updateCatalogMaintenanceAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(serviceCatalogSchema.safeParse(formObject(formData)));
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Serviço inválido.");
  await updateCatalogMaintenance({ workshopId, id, days: input.defaultReturnIntervalDays, km: input.defaultReturnIntervalKm, priceCents: parseCurrencyToCents(input.defaultPrice) });
  revalidatePath("/servicos");
  revalidatePath("/retencao");
}

export async function createInventoryItemAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(inventoryItemSchema.safeParse(formObject(formData)));
  await repository.createInventoryItem({
    workshopId,
    sku: input.sku,
    name: input.name,
    unit: input.unit,
    costCents: parseCurrencyToCents(input.cost),
    salePriceCents: parseCurrencyToCents(input.salePrice),
    currentQuantity: input.currentQuantity,
    minimumQuantity: input.minimumQuantity,
  });
  revalidatePath("/estoque");
  revalidatePath("/");
}

export async function adjustInventoryAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(
    inventoryAdjustmentSchema.safeParse(formObject(formData)),
  );
  await repository.adjustInventory({ workshopId, ...input });
  revalidatePath("/estoque");
  revalidatePath("/");
}

export async function recordContactAction(formData: FormData) {
  const { workshop, workshopId, repository } = await getOwnerContext();
  const customerId = String(formData.get("customerId") ?? "");
  const reason = String(formData.get("reason") ?? "retorno recomendado");
  const customer = await repository.findCustomer(workshopId, customerId);
  if (!customer) throw new Error("Registro não encontrado");
  const draft = buildWhatsAppDraft({
    phone: customer.phone ?? null,
    consent: customer.whatsappConsent ?? false,
    customer: customer.name,
    workshop: workshop.name,
    reason,
  });
  if (!draft)
    throw new Error(
      "Cliente sem telefone válido ou consentimento para WhatsApp.",
    );
  await repository.recordContact({
    workshopId,
    customerId,
    reason,
    message: draft.message,
  });
  redirect(draft.url);
}

export async function confirmBaseWhatsAppConsentAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  await confirmExistingWhatsAppConsent(workshopId, formData.get("confirmed") === "on");
  revalidatePath("/clientes");
  revalidatePath("/retencao");
}

export async function notifyServiceReadyAction(formData: FormData) {
  const { workshop, workshopId, repository } = await getOwnerContext();
  const serviceId = String(formData.get("serviceId") ?? "");
  const order = await repository.getServiceOrder(workshopId, serviceId);
  if (!order) throw new Error("Ordem de serviço não encontrada.");
  const draft = buildServiceReadyDraft({
    phone: order.customerPhone ?? null,
    consent: order.customerWhatsappConsent,
    customer: order.customerName,
    workshop: workshop.name,
    vehicle: order.vehicleLabel,
  });
  if (!draft)
    throw new Error(
      "Cliente sem telefone válido ou consentimento para WhatsApp.",
    );
  await repository.recordContact({
    workshopId,
    customerId: order.customerId,
    reason: "Veículo pronto",
    message: draft.message,
  });
  redirect(draft.url);
}
