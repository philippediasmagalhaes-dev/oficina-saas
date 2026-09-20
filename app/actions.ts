"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildQuoteDraft, buildServiceReadyDraft, buildWhatsAppDraft } from "../domain/outreach";
import { deriveNextDueAt } from "../domain/forecast";
import { parseCurrencyToCents } from "../domain/money";
import { canTransitionWorkOrder } from "../domain/work-orders";
import { createCrmService } from "../server/crm-service";
import { createDrizzleRepository } from "../server/drizzle-repository";
import { getOwnerContext, getOwnerUser } from "../server/owner-context";
import { updateMotorcycle } from "../server/motorcycles";
import {
  addQuoteItem,
  addServicePhoto,
  createWorkOrder,
  finalizeWorkOrder,
  getWorkOrder,
  removeQuoteItem,
  respondToQuote,
  saveDiagnosis,
  sendQuote,
  updateWorkOrderStatus,
} from "../server/work-orders";
import {
  customerSchema,
  diagnosisSchema,
  finalizationSchema,
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
} from "../server/validators";

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function parse<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new Error("Revise os campos informados.");
  return result.data;
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

export async function updateCustomerAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const customerId = String(formData.get("customerId") ?? "");
  const input = parse(customerSchema.safeParse(formObject(formData)));
  const customer = await repository.updateCustomer({
    workshopId,
    customerId,
    ...input,
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
  await repository.createVehicle({ workshopId, ...input });
  revalidatePath("/clientes");
  revalidatePath("/motos");
}

export async function updateMotorcycleAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(vehicleUpdateSchema.safeParse(formObject(formData)));
  const motorcycle = await updateMotorcycle({ workshopId, ...input });
  if (!motorcycle) throw new Error("Moto não encontrada.");
  revalidatePath("/motos");
  revalidatePath(`/motos/${input.vehicleId}`);
  redirect(`/motos/${input.vehicleId}`);
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

export async function updateWorkOrderStatusAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(workOrderStatusSchema.safeParse(formObject(formData)));
  const order = await getWorkOrder(workshopId, input.serviceRecordId);
  if (!order || !canTransitionWorkOrder(order.status, input.status)) throw new Error("Mudança de status não permitida.");
  await updateWorkOrderStatus(workshopId, input.serviceRecordId, input.status);
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
}

export async function finalizeWorkOrderAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(finalizationSchema.safeParse(formObject(formData)));
  await finalizeWorkOrder({
    workshopId,
    ...input,
    nextDueAt: input.nextDueAt ?? deriveNextDueAt(new Date(), input.returnIntervalDays),
  });
  revalidatePath(`/ordens/${input.serviceRecordId}`);
  revalidatePath("/ordens");
  revalidatePath("/motos");
  revalidatePath("/financeiro");
  revalidatePath("/retencao");
  revalidatePath("/estoque");
  revalidatePath("/");
}

export async function uploadServicePhotoAction(formData: FormData) {
  const { workshopId } = await getOwnerContext();
  const input = parse(photoSchema.safeParse(formObject(formData)));
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  if (file.size > 2_000_000) throw new Error("A foto deve ter no máximo 2 MB.");
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  const dataBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  await addServicePhoto({ workshopId, serviceRecordId: input.serviceRecordId, kind: input.kind, caption: input.caption, fileName: file.name, mimeType: file.type, dataBase64 });
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
  });
  revalidatePath("/servicos");
  revalidatePath("/financeiro");
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
