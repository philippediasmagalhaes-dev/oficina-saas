import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// Better Auth core schema. Identity lives in the same Neon database as the app.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_unique").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const serviceStatus = pgEnum("service_status", [
  "completed",
  "open",
  "diagnosis",
  "awaiting_approval",
  "approved",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
]);
export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "approved", "rejected"]);
export const quoteItemType = pgEnum("quote_item_type", ["service", "part"]);
export const servicePhotoKind = pgEnum("service_photo_kind", ["intake", "diagnosis", "completion"]);
export const movementType = pgEnum("inventory_movement_type", ["entry", "consumption", "adjustment"]);
export const contactChannel = pgEnum("contact_channel", ["whatsapp"]);
export const compensationMode = pgEnum("compensation_mode", [
  "fixed_monthly",
  "fixed_per_service",
  "percentage",
  "hybrid",
]);
export const workOrderPaymentStatus = pgEnum("work_order_payment_status", [
  "expected",
  "paid",
  "cancelled",
]);
export const financialDirection = pgEnum("financial_direction", ["income", "expense", "reserve"]);
export const financialStatus = pgEnum("financial_status", ["expected", "settled", "cancelled"]);
export const messageOutboxStatus = pgEnum("message_outbox_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
]);

export const workshops = pgTable(
  "workshops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    document: text("document"),
    phone: text("phone"),
    whatsappNumber: text("whatsapp_number"),
    email: text("email"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressDistrict: text("address_district"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressPostalCode: text("address_postal_code"),
    printTerms: text("print_terms"),
    inactivityDays: integer("inactivity_days").default(180).notNull(),
    locale: text("locale").default("pt-BR").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [check("workshops_inactivity_positive", sql`${table.inactivityDays} > 0`)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    document: text("document"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressDistrict: text("address_district"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressPostalCode: text("address_postal_code"),
    whatsappConsent: boolean("whatsapp_consent").default(false).notNull(),
    whatsappConsentAt: timestamp("whatsapp_consent_at", { withTimezone: true }),
    whatsappConsentSource: text("whatsapp_consent_source"),
    whatsappOptOutAt: timestamp("whatsapp_opt_out_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("customers_workshop_idx").on(table.workshopId),
    index("customers_workshop_name_idx").on(table.workshopId, table.name),
    uniqueIndex("customers_id_workshop_unique").on(table.id, table.workshopId),
  ],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    plate: text("plate").notNull(),
    plateNormalized: text("plate_normalized"),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year"),
    category: text("category").default("car").notNull(),
    color: text("color"),
    manufactureYear: integer("manufacture_year"),
    modelYear: integer("model_year"),
    fuel: text("fuel"),
    engineDisplacement: text("engine_displacement"),
    power: text("power"),
    municipality: text("municipality"),
    state: text("state"),
    maskedChassis: text("masked_chassis"),
    lookupProvider: text("lookup_provider"),
    lookupAt: timestamp("lookup_at", { withTimezone: true }),
    lookupSnapshot: jsonb("lookup_snapshot").$type<Record<string, unknown>>(),
    odometer: integer("odometer"),
    ...timestamps,
  },
  (table) => [
    index("vehicles_workshop_idx").on(table.workshopId),
    index("vehicles_customer_idx").on(table.workshopId, table.customerId),
    uniqueIndex("vehicles_plate_unique").on(table.workshopId, table.plate),
    check("vehicles_year_valid", sql`${table.year} is null or ${table.year} >= 1900`),
    check("vehicles_odometer_nonnegative", sql`${table.odometer} is null or ${table.odometer} >= 0`),
  ],
);

export const serviceCatalogItems = pgTable(
  "service_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultPriceCents: integer("default_price_cents").default(0).notNull(),
    defaultReturnIntervalDays: integer("default_return_interval_days"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("service_catalog_workshop_name_idx").on(table.workshopId, table.name),
    uniqueIndex("service_catalog_workshop_name_unique").on(table.workshopId, table.name),
    check("service_catalog_price_nonnegative", sql`${table.defaultPriceCents} >= 0`),
    check("service_catalog_interval_positive", sql`${table.defaultReturnIntervalDays} is null or ${table.defaultReturnIntervalDays} > 0`),
  ],
);

export const serviceRecords = pgTable(
  "service_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    orderNumber: integer("order_number"),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogItems.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    status: serviceStatus("status").default("open").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    amountCents: integer("amount_cents").default(0).notNull(),
    odometer: integer("odometer"),
    notes: text("notes"),
    complaint: text("complaint"),
    diagnosis: text("diagnosis"),
    quoteStatus: quoteStatus("quote_status").default("draft").notNull(),
    quoteToken: uuid("quote_token").defaultRandom().notNull().unique(),
    quoteDiscountCents: integer("quote_discount_cents").default(0).notNull(),
    quoteValidUntil: timestamp("quote_valid_until", { withTimezone: true }),
    quoteRespondedAt: timestamp("quote_responded_at", { withTimezone: true }),
    quoteVersion: integer("quote_version").default(1).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    financialClosedAt: timestamp("financial_closed_at", { withTimezone: true }),
    taxBasisPoints: integer("tax_basis_points"),
    taxReserveCents: integer("tax_reserve_cents").default(0).notNull(),
    feeTotalCents: integer("fee_total_cents").default(0).notNull(),
    netTotalCents: integer("net_total_cents").default(0).notNull(),
    paymentMethod: text("payment_method"),
    paymentStatus: text("payment_status").default("pending").notNull(),
    warrantyDays: integer("warranty_days"),
    deliveredOdometer: integer("delivered_odometer"),
    returnIntervalDays: integer("return_interval_days"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("services_workshop_date_idx").on(table.workshopId, table.completedAt),
    index("services_customer_idx").on(table.workshopId, table.customerId),
    index("services_catalog_idx").on(table.workshopId, table.serviceCatalogId),
    uniqueIndex("services_workshop_order_number_unique").on(table.workshopId, table.orderNumber),
    check("services_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check("services_odometer_nonnegative", sql`${table.odometer} is null or ${table.odometer} >= 0`),
    check("services_interval_positive", sql`${table.returnIntervalDays} is null or ${table.returnIntervalDays} > 0`),
    check("services_discount_nonnegative", sql`${table.quoteDiscountCents} >= 0`),
    check("services_warranty_nonnegative", sql`${table.warrantyDays} is null or ${table.warrantyDays} >= 0`),
  ],
);

export const workOrderItems = pgTable(
  "work_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    serviceRecordId: uuid("service_record_id").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
    type: quoteItemType("type").notNull(),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogItems.id, { onDelete: "set null" }),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents").default(0).notNull(),
    costCents: integer("cost_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    approvalState: text("approval_state").default("pending").notNull(),
    completionState: text("completion_state").default("pending").notNull(),
    reservationState: text("reservation_state").default("none").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("work_order_items_order_idx").on(table.workshopId, table.serviceRecordId),
    check("work_order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("work_order_items_price_nonnegative", sql`${table.unitPriceCents} >= 0`),
  ],
);

export const servicePhotos = pgTable(
  "service_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    serviceRecordId: uuid("service_record_id").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
    kind: servicePhotoKind("kind").notNull(),
    caption: text("caption"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    dataBase64: text("data_base64"),
    storageKey: text("storage_key"),
    sizeBytes: integer("size_bytes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("service_photos_order_idx").on(table.workshopId, table.serviceRecordId),
    uniqueIndex("service_photos_storage_key_unique")
      .on(table.storageKey)
      .where(sql`${table.storageKey} is not null`),
    check(
      "service_photos_size_nonnegative",
      sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`,
    ),
  ],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    sku: text("sku"),
    name: text("name").notNull(),
    unit: text("unit").default("un").notNull(),
    costCents: integer("cost_cents").default(0).notNull(),
    salePriceCents: integer("sale_price_cents").default(0).notNull(),
    currentQuantity: integer("current_quantity").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    minimumQuantity: integer("minimum_quantity").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("inventory_workshop_name_idx").on(table.workshopId, table.name),
    uniqueIndex("inventory_workshop_sku_unique").on(table.workshopId, table.sku),
    check("inventory_cost_nonnegative", sql`${table.costCents} >= 0`),
    check("inventory_price_nonnegative", sql`${table.salePriceCents} >= 0`),
    check("inventory_quantity_nonnegative", sql`${table.currentQuantity} >= 0`),
    check("inventory_reserved_valid", sql`${table.reservedQuantity} >= 0 and ${table.reservedQuantity} <= ${table.currentQuantity}`),
    check("inventory_minimum_nonnegative", sql`${table.minimumQuantity} >= 0`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: "restrict" }),
    serviceRecordId: uuid("service_record_id").references(() => serviceRecords.id, { onDelete: "set null" }),
    type: movementType("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    reservationDelta: integer("reservation_delta").default(0).notNull(),
    operationKey: text("operation_key"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("movements_workshop_date_idx").on(table.workshopId, table.createdAt),
    index("movements_item_idx").on(table.workshopId, table.inventoryItemId),
    uniqueIndex("inventory_movements_operation_unique").on(table.workshopId, table.operationKey),
    check("movements_delta_nonzero", sql`${table.quantityDelta} <> 0 or ${table.reservationDelta} <> 0`),
  ],
);

export const contactEvents = pgTable(
  "contact_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    channel: contactChannel("channel").default("whatsapp").notNull(),
    reason: text("reason").notNull(),
    message: text("message").notNull(),
    contactedAt: timestamp("contacted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contacts_workshop_date_idx").on(table.workshopId, table.contactedAt),
    index("contacts_customer_idx").on(table.workshopId, table.customerId),
  ],
);

export const workshopFinancialSettings = pgTable("workshop_financial_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().unique().references(() => workshops.id, { onDelete: "cascade" }),
  defaultTaxBasisPoints: integer("default_tax_basis_points").default(0).notNull(),
  defaultRecognitionMode: text("default_recognition_mode").default("cash").notNull(),
  ...timestamps,
}, (table) => [
  check("workshop_financial_tax_range", sql`${table.defaultTaxBasisPoints} >= 0 and ${table.defaultTaxBasisPoints} <= 10000`),
]);

export const paymentFeeRules = pgTable("payment_fee_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(),
  installmentCount: integer("installment_count").default(1).notNull(),
  percentageBasisPoints: integer("percentage_basis_points").default(0).notNull(),
  fixedFeeCents: integer("fixed_fee_cents").default(0).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [
  index("payment_fee_rules_lookup_idx").on(table.workshopId, table.paymentMethod, table.installmentCount),
  check("payment_fee_rules_installments_positive", sql`${table.installmentCount} > 0`),
  check("payment_fee_rules_percentage_range", sql`${table.percentageBasisPoints} >= 0 and ${table.percentageBasisPoints} <= 10000`),
  check("payment_fee_rules_fixed_nonnegative", sql`${table.fixedFeeCents} >= 0`),
]);

export const workshopSequences = pgTable("workshop_sequences", {
  workshopId: uuid("workshop_id").primaryKey().references(() => workshops.id, { onDelete: "cascade" }),
  nextWorkOrderNumber: integer("next_work_order_number").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("workshop_sequence_positive", sql`${table.nextWorkOrderNumber} > 0`)]);

export const workshopIntegrations = pgTable("workshop_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  status: text("status").default("not_configured").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [uniqueIndex("workshop_integrations_provider_unique").on(table.workshopId, table.provider)]);

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  locale: text("locale").default("pt_BR").notNull(),
  providerTemplateId: text("provider_template_id"),
  body: text("body").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("message_templates_purpose_unique").on(table.workshopId, table.purpose, table.locale)]);

export const vehicleInspections = pgTable("vehicle_inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").notNull().unique().references(() => serviceRecords.id, { onDelete: "cascade" }),
  odometer: integer("odometer"),
  fuelLevel: text("fuel_level"),
  tireCondition: text("tire_condition"),
  checklist: jsonb("checklist").$type<Record<string, boolean>>().default({}).notNull(),
  observations: text("observations"),
  customerAcknowledgedAt: timestamp("customer_acknowledged_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("vehicle_inspections_workshop_idx").on(table.workshopId, table.serviceRecordId)]);

export const inspectionDamageMarks = pgTable("inspection_damage_marks", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  inspectionId: uuid("inspection_id").notNull().references(() => vehicleInspections.id, { onDelete: "cascade" }),
  vehicleView: text("vehicle_view").notNull(),
  xBasisPoints: integer("x_basis_points").notNull(),
  yBasisPoints: integer("y_basis_points").notNull(),
  damageType: text("damage_type").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("inspection_damage_marks_inspection_idx").on(table.workshopId, table.inspectionId),
  check("inspection_damage_x_range", sql`${table.xBasisPoints} >= 0 and ${table.xBasisPoints} <= 10000`),
  check("inspection_damage_y_range", sql`${table.yBasisPoints} >= 0 and ${table.yBasisPoints} <= 10000`),
]);

export const workOrderStatusEvents = pgTable("work_order_status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("work_order_status_events_order_idx").on(table.workshopId, table.serviceRecordId, table.occurredAt)]);

export const workOrderApprovals = pgTable("work_order_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
  quoteVersion: integer("quote_version").notNull(),
  decision: text("decision").notNull(),
  source: text("source").default("public_link").notNull(),
  publicToken: uuid("public_token").notNull(),
  customerNote: text("customer_note"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("work_order_approvals_version_unique").on(table.serviceRecordId, table.quoteVersion)]);

export const collaborators = pgTable("collaborators", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  compensationMode: compensationMode("compensation_mode").notNull(),
  monthlyFixedCents: integer("monthly_fixed_cents").default(0).notNull(),
  fixedPerServiceCents: integer("fixed_per_service_cents").default(0).notNull(),
  commissionBasisPoints: integer("commission_basis_points").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [
  index("collaborators_workshop_idx").on(table.workshopId, table.name),
  check("collaborators_monthly_nonnegative", sql`${table.monthlyFixedCents} >= 0`),
  check("collaborators_service_nonnegative", sql`${table.fixedPerServiceCents} >= 0`),
  check("collaborators_commission_range", sql`${table.commissionBasisPoints} >= 0 and ${table.commissionBasisPoints} <= 10000`),
]);

export const collaboratorServiceRates = pgTable("collaborator_service_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaborators.id, { onDelete: "cascade" }),
  serviceCatalogId: uuid("service_catalog_id").notNull().references(() => serviceCatalogItems.id, { onDelete: "cascade" }),
  fixedPerServiceCents: integer("fixed_per_service_cents"),
  commissionBasisPoints: integer("commission_basis_points"),
  ...timestamps,
}, (table) => [
  uniqueIndex("collaborator_service_rates_unique").on(table.workshopId, table.collaboratorId, table.serviceCatalogId),
]);

export const workOrderItemAssignments = pgTable("work_order_item_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  workOrderItemId: uuid("work_order_item_id").notNull().references(() => workOrderItems.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaborators.id, { onDelete: "restrict" }),
  participationBasisPoints: integer("participation_basis_points").default(10000).notNull(),
  commissionBasisPointsSnapshot: integer("commission_basis_points_snapshot").default(0).notNull(),
  fixedPerServiceCentsSnapshot: integer("fixed_per_service_cents_snapshot").default(0).notNull(),
  laborBaseCentsSnapshot: integer("labor_base_cents_snapshot"),
  compensationCentsSnapshot: integer("compensation_cents_snapshot"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("work_order_item_assignments_unique").on(table.workOrderItemId, table.collaboratorId),
  check("work_order_assignment_participation_range", sql`${table.participationBasisPoints} > 0 and ${table.participationBasisPoints} <= 10000`),
]);

export const workOrderPayments = pgTable("work_order_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(),
  amountCents: integer("amount_cents").notNull(),
  installmentCount: integer("installment_count").default(1).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expectedAt: timestamp("expected_at", { withTimezone: true }).notNull(),
  status: workOrderPaymentStatus("status").default("expected").notNull(),
  feePercentageBasisPoints: integer("fee_percentage_basis_points").default(0).notNull(),
  feeFixedCents: integer("fee_fixed_cents").default(0).notNull(),
  manualFeeCents: integer("manual_fee_cents"),
  feeAmountCents: integer("fee_amount_cents").default(0).notNull(),
  netAmountCents: integer("net_amount_cents").default(0).notNull(),
  ...timestamps,
}, (table) => [
  index("work_order_payments_order_idx").on(table.workshopId, table.serviceRecordId),
  check("work_order_payment_amount_positive", sql`${table.amountCents} > 0`),
  check("work_order_payment_installments_positive", sql`${table.installmentCount} > 0`),
]);

export const financialEntries = pgTable("financial_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").references(() => serviceRecords.id, { onDelete: "set null" }),
  paymentId: uuid("payment_id").references(() => workOrderPayments.id, { onDelete: "set null" }),
  collaboratorId: uuid("collaborator_id").references(() => collaborators.id, { onDelete: "set null" }),
  externalId: text("external_id").notNull(),
  direction: financialDirection("direction").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  feeAmountCents: integer("fee_amount_cents").default(0).notNull(),
  netAmountCents: integer("net_amount_cents").notNull(),
  competenceDate: timestamp("competence_date", { withTimezone: true }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  status: financialStatus("status").default("expected").notNull(),
  recurrenceKey: text("recurrence_key"),
  ...timestamps,
}, (table) => [
  uniqueIndex("financial_entries_external_id_unique").on(table.workshopId, table.externalId),
  index("financial_entries_period_idx").on(table.workshopId, table.competenceDate, table.dueDate),
]);

export const financialAttachments = pgTable("financial_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  financialEntryId: uuid("financial_entry_id").notNull().references(() => financialEntries.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messageOutbox = pgTable("message_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  serviceRecordId: uuid("service_record_id").references(() => serviceRecords.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  purpose: text("purpose").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  templateName: text("template_name"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: messageOutboxStatus("status").default("pending").notNull(),
  providerMessageId: text("provider_message_id"),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("message_outbox_idempotency_unique").on(table.workshopId, table.idempotencyKey),
  index("message_outbox_schedule_idx").on(table.status, table.scheduledAt),
]);

export const messageDeliveries = pgTable("message_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  outboxId: uuid("outbox_id").notNull().references(() => messageOutbox.id, { onDelete: "cascade" }),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull(),
  detail: text("detail"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("message_deliveries_outbox_idx").on(table.workshopId, table.outboxId)]);

export const businessFinExports = pgTable("business_fin_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  workshopId: uuid("workshop_id").notNull().references(() => workshops.id, { onDelete: "cascade" }),
  financialEntryId: uuid("financial_entry_id").notNull().references(() => financialEntries.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  exportedAt: timestamp("exported_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("business_fin_exports_entry_unique").on(table.workshopId, table.financialEntryId)]);

export const schema = {
  user, session, account, verification, workshops, customers, vehicles,
  serviceCatalogItems, serviceRecords, workOrderItems, servicePhotos,
  inventoryItems, inventoryMovements, contactEvents,
  workshopFinancialSettings, paymentFeeRules, workshopSequences,
  workshopIntegrations, messageTemplates, vehicleInspections,
  inspectionDamageMarks, workOrderStatusEvents, workOrderApprovals,
  collaborators, collaboratorServiceRates, workOrderItemAssignments,
  workOrderPayments, financialEntries, financialAttachments, messageOutbox,
  messageDeliveries, businessFinExports,
};

export type Workshop = typeof workshops.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type WorkOrderItem = typeof workOrderItems.$inferSelect;
export type ServicePhoto = typeof servicePhotos.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Collaborator = typeof collaborators.$inferSelect;
export type WorkOrderPayment = typeof workOrderPayments.$inferSelect;
export type FinancialEntry = typeof financialEntries.$inferSelect;
