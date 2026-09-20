"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildServiceReadyDraft, buildWhatsAppDraft } from "../domain/outreach";
import { deriveNextDueAt } from "../domain/forecast";
import { parseCurrencyToCents } from "../domain/money";
import { createCrmService } from "../server/crm-service";
import { createDrizzleRepository } from "../server/drizzle-repository";
import { getOwnerContext, getOwnerUser } from "../server/owner-context";
import {
  customerSchema,
  inventoryAdjustmentSchema,
  inventoryItemSchema,
  serviceCatalogSchema,
  serviceSchema,
  vehicleSchema,
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

export async function createVehicleAction(formData: FormData) {
  const { workshopId, repository } = await getOwnerContext();
  const input = parse(vehicleSchema.safeParse(formObject(formData)));
  if (!(await repository.findCustomer(workshopId, input.customerId)))
    throw new Error("Registro não encontrado");
  await repository.createVehicle({ workshopId, ...input });
  revalidatePath("/clientes");
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
