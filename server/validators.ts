import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
const optionalInteger = z.union([z.literal(""), z.coerce.number().int().nonnegative()]).transform((value) => value === "" ? null : value);

export const workshopSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da oficina"),
  inactivityDays: z.coerce.number().int().min(30).max(730).default(180),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente"),
  phone: optionalText,
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido")]).transform((value) => value || null),
  whatsappConsent: z.coerce.boolean().default(false),
  notes: optionalText,
});

export const vehicleSchema = z.object({
  customerId: z.string().uuid(),
  plate: z.string().trim().min(7).max(8).transform((value) => value.toUpperCase()),
  make: z.string().trim().min(2),
  model: z.string().trim().min(1),
  year: optionalInteger,
  odometer: optionalInteger,
});

export const serviceSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.union([z.literal(""), z.string().uuid()]).transform((value) => value || null),
  serviceCatalogId: z.string().uuid(),
  amount: z.string().trim().min(1),
  completedAt: z.coerce.date(),
  odometer: optionalInteger,
  notes: optionalText,
  returnIntervalDays: optionalInteger,
  nextDueAt: z.union([z.literal(""), z.coerce.date()]).transform((value) => value === "" ? null : value),
  inventory: z.array(z.object({ inventoryItemId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).default([]),
});

export const serviceCatalogSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço"),
  defaultPrice: z.string().trim().min(1),
  defaultReturnIntervalDays: optionalInteger,
});

export const inventoryItemSchema = z.object({
  sku: optionalText,
  name: z.string().trim().min(2),
  unit: z.string().trim().min(1).default("un"),
  cost: z.string().trim().default("0"),
  salePrice: z.string().trim().default("0"),
  currentQuantity: z.coerce.number().int().nonnegative(),
  minimumQuantity: z.coerce.number().int().nonnegative(),
});

export const inventoryAdjustmentSchema = z.object({
  inventoryItemId: z.string().uuid(),
  delta: z.coerce.number().int().refine((value) => value !== 0, "Informe uma movimentação"),
  note: optionalText,
});

export const workOrderSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  complaint: z.string().trim().min(5, "Descreva o motivo da entrada"),
  odometer: optionalInteger,
  notes: optionalText,
});

export const diagnosisSchema = z.object({
  serviceRecordId: z.string().uuid(),
  complaint: z.string().trim().min(5),
  diagnosis: z.string().trim().min(5, "Informe o diagnóstico"),
  notes: optionalText,
});

export const quoteItemSchema = z.object({
  serviceRecordId: z.string().uuid(),
  type: z.enum(["service", "part"]),
  referenceId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.string().trim().min(1),
});

export const quoteSettingsSchema = z.object({
  serviceRecordId: z.string().uuid(),
  discount: z.string().trim().default("0"),
  validUntil: z.union([z.literal(""), z.coerce.date()]).transform((value) => value === "" ? null : value),
});

export const workOrderStatusSchema = z.object({
  serviceRecordId: z.string().uuid(),
  status: z.enum(["diagnosis", "in_progress", "ready", "cancelled"]),
});

export const finalizationSchema = z.object({
  serviceRecordId: z.string().uuid(),
  paymentMethod: z.string().trim().min(2),
  paymentStatus: z.enum(["pending", "paid"]),
  warrantyDays: optionalInteger,
  deliveredOdometer: optionalInteger,
  returnIntervalDays: optionalInteger,
  nextDueAt: z.union([z.literal(""), z.coerce.date()]).transform((value) => value === "" ? null : value),
});

export const photoSchema = z.object({
  serviceRecordId: z.string().uuid(),
  kind: z.enum(["intake", "diagnosis", "completion"]),
  caption: optionalText,
});

export const vehicleUpdateSchema = vehicleSchema.extend({ vehicleId: z.string().uuid() });
