import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
const optionalInteger = z.union([z.literal(""), z.coerce.number().int().nonnegative()]).transform((value) => value === "" ? null : value);
const stateCode = z.union([z.literal(""), z.string().trim().length(2)]).transform((value) => value ? value.toUpperCase() : null);

export const workshopSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da oficina"),
  inactivityDays: z.coerce.number().int().min(30).max(730).default(180),
});

export const workshopSettingsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da oficina"),
  legalName: optionalText,
  document: optionalText,
  phone: optionalText,
  whatsappNumber: optionalText,
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido")]).transform((value) => value || null),
  addressStreet: optionalText,
  addressNumber: optionalText,
  addressComplement: optionalText,
  addressDistrict: optionalText,
  addressCity: optionalText,
  addressState: stateCode,
  addressPostalCode: optionalText,
  printTerms: optionalText,
  inactivityDays: z.coerce.number().int().min(30).max(730),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente"),
  phone: optionalText,
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido")]).transform((value) => value || null),
  document: optionalText,
  addressStreet: optionalText,
  addressNumber: optionalText,
  addressComplement: optionalText,
  addressDistrict: optionalText,
  addressCity: optionalText,
  addressState: stateCode,
  addressPostalCode: optionalText,
  whatsappConsent: z.coerce.boolean().default(false),
  notes: optionalText,
});

export const vehicleSchema = z.object({
  customerId: z.string().uuid(),
  plate: z.string().trim().transform((value) => value.replace(/[^a-z0-9]/gi, "").toUpperCase()).pipe(z.string().length(7, "Placa inválida")),
  make: z.string().trim().min(2),
  model: z.string().trim().min(1),
  year: optionalInteger,
  category: z.enum(["car", "two_wheels", "utility", "other"]).default("car"),
  color: optionalText,
  manufactureYear: optionalInteger,
  modelYear: optionalInteger,
  fuel: optionalText,
  engineDisplacement: optionalText,
  power: optionalText,
  municipality: optionalText,
  state: stateCode,
  maskedChassis: optionalText,
  lookupProvider: z.string().trim().default("").transform((value) => value || null),
  lookupSnapshot: z.string().trim().default("").transform((value) => {
    if (!value) return null;
    try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; } catch { return null; }
  }),
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
  defaultReturnIntervalKm: optionalInteger,
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
  payments: z.string().transform((value, context) => {
    try { return JSON.parse(value) as unknown; } catch { context.addIssue({ code: "custom", message: "Pagamentos inválidos" }); return z.NEVER; }
  }).pipe(z.array(z.object({
    paymentMethod: z.enum(["pix", "cash", "debit_card", "credit_card", "transfer", "other"]),
    amount: z.string().trim().min(1),
    installmentCount: z.coerce.number().int().min(1).max(24),
    paid: z.boolean(),
    expectedAt: z.coerce.date(),
    manualFee: z.string().trim(),
  })).min(1)),
  taxPercent: z.coerce.number().min(0).max(100),
  warrantyDays: optionalInteger,
  deliveredOdometer: optionalInteger,
  returnIntervalDays: optionalInteger,
  nextDueAt: z.union([z.literal(""), z.coerce.date()]).transform((value) => value === "" ? null : value),
});

export const financialSettingsSchema = z.object({
  defaultTaxPercent: z.coerce.number().min(0).max(100),
  defaultRecognitionMode: z.enum(["cash", "accrual"]),
});

export const financialCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  direction: z.enum(["income", "expense", "reserve"]),
});

export const financialCategoryUpdateSchema = financialCategorySchema.extend({
  categoryId: z.string().uuid(),
});

export const financialCategoryIdSchema = z.object({ categoryId: z.string().uuid() });
export const paymentFeeRuleIdSchema = z.object({ ruleId: z.string().uuid() });

export const paymentFeeRuleSchema = z.object({
  paymentMethod: z.enum(["pix", "cash", "debit_card", "credit_card", "transfer", "other"]),
  installmentCount: z.coerce.number().int().min(1).max(24),
  percentage: z.coerce.number().min(0).max(100),
  fixedFee: z.string().trim().default("0"),
});

export const manualFinancialEntrySchema = z.object({
  direction: z.enum(["income", "expense", "reserve"]),
  category: z.string().trim().min(2),
  description: z.string().trim().min(2),
  amount: z.string().trim().min(1),
  competenceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  settled: z.coerce.boolean().default(false),
  recurringMonthly: z.coerce.boolean().default(false),
  installmentCount: z.coerce.number().int().min(1).max(48).default(1),
  supplierId: z.union([z.literal(""), z.string().uuid()]).optional().transform((value) => value || null),
  financialAccountId: z.union([z.literal(""), z.string().uuid()]).optional().transform((value) => value || null),
  documentNumber: optionalText,
  notes: optionalText,
});

export const financialSettlementSchema = z.object({
  financialEntryId: z.string().uuid(),
  amount: z.string().trim().min(1),
  financialAccountId: z.union([z.literal(""), z.string().uuid()]).optional().transform((value) => value || null),
  paymentMethod: optionalText,
  note: optionalText,
});

export const financialSettlementReversalSchema = z.object({
  financialEntryId: z.string().uuid(),
  settlementId: z.string().uuid(),
  note: optionalText,
});

export const financialAccountSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(["cash", "bank", "digital_wallet", "card_clearing"]),
  openingBalance: z.string().trim().default("0"),
});

export const supplierSchema = z.object({
  supplierId: z.union([z.literal(""), z.string().uuid()]).optional().transform((value) => value || null),
  name: z.string().trim().min(2),
  document: optionalText,
  phone: optionalText,
  email: z.union([z.literal(""), z.string().email()]).optional().transform((value) => value || null),
  notes: optionalText,
});

export const cashSessionOpenSchema = z.object({
  financialAccountId: z.string().uuid(),
  openingBalance: z.string().trim().default("0"),
});

export const cashSessionCloseSchema = z.object({
  cashSessionId: z.string().uuid(),
  declaredClosing: z.string().trim().min(1),
  note: optionalText,
});

export const photoSchema = z.object({
  serviceRecordId: z.string().uuid(),
  kind: z.enum(["intake", "diagnosis", "completion"]),
  caption: optionalText,
});

export const vehicleUpdateSchema = vehicleSchema.extend({ vehicleId: z.string().uuid() });

export const collaboratorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do colaborador"),
  phone: optionalText,
  compensationMode: z.enum(["fixed_monthly", "fixed_per_service", "percentage", "hybrid"]),
  monthlyFixed: z.string().trim().default("0"),
  fixedPerService: z.string().trim().default("0"),
  commissionPercent: z.coerce.number().min(0).max(100),
});

export const collaboratorUpdateSchema = collaboratorSchema.extend({
  collaboratorId: z.string().uuid(),
});

export const collaboratorRateSchema = z.object({
  collaboratorId: z.string().uuid(),
  serviceCatalogId: z.string().uuid(),
  fixedPerService: z.string().trim().default(""),
  commissionPercent: z.union([z.literal(""), z.coerce.number().min(0).max(100)]).transform((value) => value === "" ? null : value),
});

export const collaboratorIdSchema = z.object({ collaboratorId: z.string().uuid() });
export const collaboratorRateIdSchema = z.object({ rateId: z.string().uuid() });

export const assignmentSchema = z.object({
  serviceRecordId: z.string().uuid(),
  workOrderItemId: z.string().uuid(),
  collaboratorId: z.string().uuid(),
  participationPercent: z.coerce.number().positive().max(100),
});
