import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import {
  createDatabase,
  getDatabase,
  runDatabaseTransaction,
  runDatabaseTransactionForUrl,
  type Database,
} from "../db/client";
import {
  contactEvents,
  customers,
  inventoryItems,
  inventoryMovements,
  serviceCatalogItems,
  serviceRecords,
  vehicles,
  workshops,
} from "../db/schema";
import type {
  CrmRepository,
  PersistedServiceInput,
  ServiceWithInventoryInput,
} from "./ports";
import { normalizeBrazilianPhone, normalizePlate } from "../domain/workshop-settings";
import { buildPageWindow, escapeLikePattern } from "../domain/pagination";

function serviceValues(input: PersistedServiceInput) {
  return {
    workshopId: input.workshopId,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    serviceCatalogId: input.serviceCatalogId,
    description: input.description,
    amountCents: input.amountCents,
    intakeAt: input.completedAt,
    completedAt: input.completedAt,
    odometer: input.odometer,
    notes: input.notes,
    returnIntervalDays: input.returnIntervalDays,
    nextDueAt: input.nextDueAt,
  };
}

export function createDrizzleRepository(
  database: Database = getDatabase(),
  runTransaction: typeof runDatabaseTransaction = runDatabaseTransaction,
): CrmRepository {
  return {
    async getWorkshopForUser(userId) {
      const [row] = await database
        .select()
        .from(workshops)
        .where(eq(workshops.ownerUserId, userId))
        .limit(1);
      return row ?? null;
    },
    async createWorkshop(input) {
      const [row] = await database.insert(workshops).values(input).returning();
      return row;
    },
    async updateWorkshop(input) {
      const [row] = await database.update(workshops).set({
        name: input.name,
        legalName: input.legalName,
        document: input.document,
        phone: input.phone,
        whatsappNumber: input.whatsappNumber,
        email: input.email,
        addressStreet: input.addressStreet,
        addressNumber: input.addressNumber,
        addressComplement: input.addressComplement,
        addressDistrict: input.addressDistrict,
        addressCity: input.addressCity,
        addressState: input.addressState,
        addressPostalCode: input.addressPostalCode,
        printTerms: input.printTerms,
        inactivityDays: input.inactivityDays,
      }).where(eq(workshops.id, input.id)).returning();
      return row ?? null;
    },
    async findCustomer(workshopId, customerId) {
      const [row] = await database
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.workshopId, workshopId),
            eq(customers.id, customerId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async findVehicle(workshopId, vehicleId) {
      const [row] = await database
        .select()
        .from(vehicles)
        .where(
          and(eq(vehicles.workshopId, workshopId), eq(vehicles.id, vehicleId)),
        )
        .limit(1);
      return row ?? null;
    },
    async findServiceCatalogItem(workshopId, serviceCatalogId) {
      const [row] = await database
        .select()
        .from(serviceCatalogItems)
        .where(
          and(
            eq(serviceCatalogItems.workshopId, workshopId),
            eq(serviceCatalogItems.id, serviceCatalogId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async listCustomers(workshopId) {
      const rows = await database
        .select()
        .from(customers)
        .where(eq(customers.workshopId, workshopId))
        .orderBy(customers.name);
      const services = await database
        .select({
          customerId: serviceRecords.customerId,
          lastServiceAt: max(serviceRecords.completedAt),
          nextDueAt: max(serviceRecords.nextDueAt),
        })
        .from(serviceRecords)
        .where(eq(serviceRecords.workshopId, workshopId))
        .groupBy(serviceRecords.customerId);
      const vehicleRows = await database
        .select({ customerId: vehicles.customerId, vehicleCount: count() })
        .from(vehicles)
        .where(eq(vehicles.workshopId, workshopId))
        .groupBy(vehicles.customerId);
      const servicesByCustomer = new Map(
        services.map((service) => [service.customerId, service]),
      );
      const vehiclesByCustomer = new Map(
        vehicleRows.map((vehicle) => [vehicle.customerId, Number(vehicle.vehicleCount)]),
      );
      return rows.map((customer) => {
        const history = servicesByCustomer.get(customer.id);
        return {
          ...customer,
          lastServiceAt: history?.lastServiceAt ?? null,
          nextDueAt: history?.nextDueAt ?? null,
          vehicleCount: vehiclesByCustomer.get(customer.id) ?? 0,
        };
      });
    },
    async listCustomersPage(workshopId, input) {
      const query = input.query.trim();
      const pattern = `%${escapeLikePattern(query)}%`;
      const filter = and(
        eq(customers.workshopId, workshopId),
        query
          ? or(
              ilike(customers.name, pattern),
              ilike(customers.phone, pattern),
              ilike(customers.email, pattern),
              ilike(customers.document, pattern),
            )
          : undefined,
      );
      const [{ total: rawTotal }] = await database
        .select({ total: count() })
        .from(customers)
        .where(filter);
      const window = buildPageWindow({
        total: Number(rawTotal),
        page: input.page,
        pageSize: input.pageSize,
      });
      const rows = await database
        .select()
        .from(customers)
        .where(filter)
        .orderBy(customers.name)
        .limit(window.pageSize)
        .offset(window.offset);
      if (!rows.length) return { ...window, items: [] };
      const customerIds = rows.map((customer) => customer.id);
      const [services, vehicleRows] = await Promise.all([
        database
          .select({
            customerId: serviceRecords.customerId,
            lastServiceAt: max(serviceRecords.completedAt),
            nextDueAt: max(serviceRecords.nextDueAt),
          })
          .from(serviceRecords)
          .where(
            and(
              eq(serviceRecords.workshopId, workshopId),
              inArray(serviceRecords.customerId, customerIds),
            ),
          )
          .groupBy(serviceRecords.customerId),
        database
          .select({ customerId: vehicles.customerId, vehicleCount: count() })
          .from(vehicles)
          .where(
            and(
              eq(vehicles.workshopId, workshopId),
              inArray(vehicles.customerId, customerIds),
            ),
          )
          .groupBy(vehicles.customerId),
      ]);
      const servicesByCustomer = new Map(
        services.map((service) => [service.customerId, service]),
      );
      const vehiclesByCustomer = new Map(
        vehicleRows.map((vehicle) => [vehicle.customerId, Number(vehicle.vehicleCount)]),
      );
      return {
        ...window,
        items: rows.map((customer) => ({
          ...customer,
          lastServiceAt:
            servicesByCustomer.get(customer.id)?.lastServiceAt ?? null,
          nextDueAt: servicesByCustomer.get(customer.id)?.nextDueAt ?? null,
          vehicleCount: vehiclesByCustomer.get(customer.id) ?? 0,
        })),
      };
    },
    async listVehicles(workshopId) {
      return database
        .select()
        .from(vehicles)
        .where(eq(vehicles.workshopId, workshopId))
        .orderBy(vehicles.plate);
    },
    async listServices(workshopId, limit) {
      const rows = await database
        .select({
          id: serviceRecords.id,
          workshopId: serviceRecords.workshopId,
          customerId: serviceRecords.customerId,
          serviceCatalogId: serviceRecords.serviceCatalogId,
          customerName: customers.name,
          vehicleLabel: sql<
            string | null
          >`case when ${vehicles.id} is null then null else concat(${vehicles.make}, ' ', ${vehicles.model}, ' · ', ${vehicles.plate}) end`,
          description: serviceRecords.description,
          amountCents: serviceRecords.amountCents,
          completedAt: serviceRecords.completedAt,
          nextDueAt: serviceRecords.nextDueAt,
        })
        .from(serviceRecords)
        .innerJoin(
          customers,
          and(
            eq(customers.id, serviceRecords.customerId),
            eq(customers.workshopId, workshopId),
          ),
        )
        .leftJoin(
          vehicles,
          and(
            eq(vehicles.id, serviceRecords.vehicleId),
            eq(vehicles.workshopId, workshopId),
          ),
        )
        .where(and(
          eq(serviceRecords.workshopId, workshopId),
          inArray(serviceRecords.status, ["completed", "delivered"]),
          isNotNull(serviceRecords.completedAt),
        ))
        .orderBy(desc(serviceRecords.completedAt))
        .limit(limit ?? 2147483647);
      return rows.map((row) => ({ ...row, completedAt: row.completedAt! }));
    },
    async getServiceOrder(workshopId, serviceId) {
      const [order] = await database
        .select({
          id: serviceRecords.id,
          workshopId: serviceRecords.workshopId,
          customerId: serviceRecords.customerId,
          serviceCatalogId: serviceRecords.serviceCatalogId,
          customerName: customers.name,
          customerPhone: customers.phone,
          customerWhatsappConsent: customers.whatsappConsent,
          vehicleLabel: sql<
            string | null
          >`case when ${vehicles.id} is null then null else concat(${vehicles.make}, ' ', ${vehicles.model}, ' · ', ${vehicles.plate}) end`,
          description: serviceRecords.description,
          amountCents: serviceRecords.amountCents,
          completedAt: serviceRecords.completedAt,
          nextDueAt: serviceRecords.nextDueAt,
          odometer: serviceRecords.odometer,
          notes: serviceRecords.notes,
          returnIntervalDays: serviceRecords.returnIntervalDays,
        })
        .from(serviceRecords)
        .innerJoin(
          customers,
          and(
            eq(customers.id, serviceRecords.customerId),
            eq(customers.workshopId, workshopId),
          ),
        )
        .leftJoin(
          vehicles,
          and(
            eq(vehicles.id, serviceRecords.vehicleId),
            eq(vehicles.workshopId, workshopId),
          ),
        )
        .where(
          and(
            eq(serviceRecords.workshopId, workshopId),
            eq(serviceRecords.id, serviceId),
          ),
        )
        .limit(1);
      if (!order) return null;

      const parts = await database
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          unit: inventoryItems.unit,
          unitCostCents: inventoryItems.costCents,
          quantity: sql<number>`abs(${inventoryMovements.quantityDelta})`,
        })
        .from(inventoryMovements)
        .innerJoin(
          inventoryItems,
          and(
            eq(inventoryItems.id, inventoryMovements.inventoryItemId),
            eq(inventoryItems.workshopId, workshopId),
          ),
        )
        .where(
          and(
            eq(inventoryMovements.workshopId, workshopId),
            eq(inventoryMovements.serviceRecordId, serviceId),
            eq(inventoryMovements.type, "consumption"),
          ),
        );

      return {
        ...order,
        parts: parts.map((part) => ({
          ...part,
          quantity: Number(part.quantity),
        })),
      };
    },
    async listServiceCatalog(workshopId) {
      return database
        .select()
        .from(serviceCatalogItems)
        .where(eq(serviceCatalogItems.workshopId, workshopId))
        .orderBy(serviceCatalogItems.name);
    },
    async listInventory(workshopId) {
      return database
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.workshopId, workshopId))
        .orderBy(inventoryItems.name);
    },
    async listContactEvents(workshopId) {
      return database
        .select()
        .from(contactEvents)
        .where(eq(contactEvents.workshopId, workshopId))
        .orderBy(desc(contactEvents.contactedAt));
    },
    async createCustomer(input) {
      const [row] = await database.insert(customers).values({
        ...input,
        phoneNormalized: input.phone ? normalizeBrazilianPhone(input.phone) : null,
        whatsappConsentAt: input.whatsappConsent ? new Date() : null,
        whatsappConsentSource: input.whatsappConsent ? "owner" : null,
      }).returning();
      return row;
    },
    async updateCustomer(input) {
      const [row] = await database
        .update(customers)
        .set({
          name: input.name,
          phone: input.phone,
          phoneNormalized: input.phoneNormalized,
          email: input.email,
          document: input.document,
          addressStreet: input.addressStreet,
          addressNumber: input.addressNumber,
          addressComplement: input.addressComplement,
          addressDistrict: input.addressDistrict,
          addressCity: input.addressCity,
          addressState: input.addressState,
          addressPostalCode: input.addressPostalCode,
          whatsappConsent: input.whatsappConsent,
          whatsappConsentAt: input.whatsappConsent ? new Date() : null,
          whatsappConsentSource: input.whatsappConsent ? "owner" : null,
          whatsappOptOutAt: input.whatsappConsent ? null : new Date(),
          notes: input.notes,
        })
        .where(
          and(
            eq(customers.workshopId, input.workshopId),
            eq(customers.id, input.customerId),
          ),
        )
        .returning();
      return row ?? null;
    },
    async createVehicle(input) {
      const [row] = await database.insert(vehicles).values({
        ...input,
        plate: normalizePlate(input.plate),
        plateNormalized: normalizePlate(input.plate),
      }).returning();
      return row;
    },
    async createServiceCatalogItem(input) {
      const [row] = await database
        .insert(serviceCatalogItems)
        .values(input)
        .returning();
      return row;
    },
    async recordService(input) {
      const [row] = await database
        .insert(serviceRecords)
        .values(serviceValues(input))
        .returning();
      return { ...row, completedAt: row.completedAt! };
    },
    async consumeInventoryAtomically(input: ServiceWithInventoryInput) {
      return runTransaction(async (tx) => {
        const [service] = await tx
          .insert(serviceRecords)
          .values(serviceValues(input))
          .returning();
        for (const consumption of input.inventory) {
          const [item] = await tx
            .update(inventoryItems)
            .set({
              currentQuantity: sql`${inventoryItems.currentQuantity} - ${consumption.quantity}`,
            })
            .where(
              and(
                eq(inventoryItems.workshopId, input.workshopId),
                eq(inventoryItems.id, consumption.inventoryItemId),
                gte(inventoryItems.currentQuantity, consumption.quantity),
              ),
            )
            .returning({ id: inventoryItems.id });
          if (!item) throw new Error("Estoque insuficiente");
          await tx.insert(inventoryMovements).values({
            workshopId: input.workshopId,
            inventoryItemId: consumption.inventoryItemId,
            serviceRecordId: service.id,
            type: "consumption",
            quantityDelta: -consumption.quantity,
            note: input.description,
          });
        }
        return { ...service, completedAt: service.completedAt! };
      });
    },
    async createInventoryItem(input) {
      const [row] = await database
        .insert(inventoryItems)
        .values(input)
        .returning();
      return row;
    },
    async adjustInventory(input) {
      return runTransaction(async (tx) => {
        const [row] = await tx
          .update(inventoryItems)
          .set({
            currentQuantity: sql`${inventoryItems.currentQuantity} + ${input.delta}`,
          })
          .where(
            and(
              eq(inventoryItems.workshopId, input.workshopId),
              eq(inventoryItems.id, input.inventoryItemId),
              gte(sql`${inventoryItems.currentQuantity} + ${input.delta}`, inventoryItems.reservedQuantity),
            ),
          )
          .returning();
        if (!row)
          throw new Error(
            input.delta < 0
              ? "Estoque insuficiente"
              : "Registro não encontrado",
          );
        await tx.insert(inventoryMovements).values({
          workshopId: input.workshopId,
          inventoryItemId: input.inventoryItemId,
          type: input.delta > 0 ? "entry" : "adjustment",
          quantityDelta: input.delta,
          note: input.note,
        });
        return row;
      });
    },
    async recordContact(input) {
      const [row] = await database
        .insert(contactEvents)
        .values({ ...input, channel: "whatsapp" })
        .returning();
      return row;
    },
  };
}

export function createRepositoryForUrl(databaseUrl: string): CrmRepository {
  return createDrizzleRepository(
    createDatabase(databaseUrl),
    (operation) => runDatabaseTransactionForUrl(databaseUrl, operation),
  );
}
