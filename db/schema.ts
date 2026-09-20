import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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

export const serviceStatus = pgEnum("service_status", ["completed"]);
export const movementType = pgEnum("inventory_movement_type", ["entry", "consumption", "adjustment"]);
export const contactChannel = pgEnum("contact_channel", ["whatsapp"]);

export const workshops = pgTable(
  "workshops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
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
    email: text("email"),
    whatsappConsent: boolean("whatsapp_consent").default(false).notNull(),
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
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year"),
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
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogItems.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    status: serviceStatus("status").default("completed").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    odometer: integer("odometer"),
    notes: text("notes"),
    returnIntervalDays: integer("return_interval_days"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("services_workshop_date_idx").on(table.workshopId, table.completedAt),
    index("services_customer_idx").on(table.workshopId, table.customerId),
    index("services_catalog_idx").on(table.workshopId, table.serviceCatalogId),
    check("services_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check("services_odometer_nonnegative", sql`${table.odometer} is null or ${table.odometer} >= 0`),
    check("services_interval_positive", sql`${table.returnIntervalDays} is null or ${table.returnIntervalDays} > 0`),
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
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("movements_workshop_date_idx").on(table.workshopId, table.createdAt),
    index("movements_item_idx").on(table.workshopId, table.inventoryItemId),
    check("movements_delta_nonzero", sql`${table.quantityDelta} <> 0`),
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

export const schema = { user, session, account, verification, workshops, customers, vehicles, serviceCatalogItems, serviceRecords, inventoryItems, inventoryMovements, contactEvents };

export type Workshop = typeof workshops.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
