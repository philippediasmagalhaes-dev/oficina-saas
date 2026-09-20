import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { getDatabase } from "../db/client";
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
import type { CrmRepository, PersistedServiceInput, ServiceWithInventoryInput } from "./ports";

type Database = ReturnType<typeof getDatabase>;

function serviceValues(input: PersistedServiceInput) {
  return {
    workshopId: input.workshopId,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    serviceCatalogId: input.serviceCatalogId,
    description: input.description,
    amountCents: input.amountCents,
    completedAt: input.completedAt,
    odometer: input.odometer,
    notes: input.notes,
    returnIntervalDays: input.returnIntervalDays,
    nextDueAt: input.nextDueAt,
  };
}

export function createDrizzleRepository(database: Database = getDatabase()): CrmRepository {
  return {
    async getWorkshopForUser(userId) {
      const [row] = await database.select().from(workshops).where(eq(workshops.ownerUserId, userId)).limit(1);
      return row ?? null;
    },
    async createWorkshop(input) {
      const [row] = await database.insert(workshops).values(input).returning();
      return row;
    },
    async findCustomer(workshopId, customerId) {
      const [row] = await database.select().from(customers).where(and(eq(customers.workshopId, workshopId), eq(customers.id, customerId))).limit(1);
      return row ?? null;
    },
    async findVehicle(workshopId, vehicleId) {
      const [row] = await database.select().from(vehicles).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.id, vehicleId))).limit(1);
      return row ?? null;
    },
    async findServiceCatalogItem(workshopId, serviceCatalogId) {
      const [row] = await database.select().from(serviceCatalogItems).where(and(eq(serviceCatalogItems.workshopId, workshopId), eq(serviceCatalogItems.id, serviceCatalogId))).limit(1);
      return row ?? null;
    },
    async listCustomers(workshopId) {
      const rows = await database.select().from(customers).where(eq(customers.workshopId, workshopId)).orderBy(customers.name);
      const services = await database.select({ customerId: serviceRecords.customerId, completedAt: serviceRecords.completedAt, nextDueAt: serviceRecords.nextDueAt }).from(serviceRecords).where(eq(serviceRecords.workshopId, workshopId)).orderBy(desc(serviceRecords.completedAt));
      const vehicleRows = await database.select({ customerId: vehicles.customerId }).from(vehicles).where(eq(vehicles.workshopId, workshopId));
      return rows.map((customer) => {
        const history = services.filter((service) => service.customerId === customer.id);
        return {
          ...customer,
          lastServiceAt: history[0]?.completedAt ?? null,
          nextDueAt: history.find((service) => service.nextDueAt)?.nextDueAt ?? null,
          vehicleCount: vehicleRows.filter((vehicle) => vehicle.customerId === customer.id).length,
        };
      });
    },
    async listVehicles(workshopId) {
      return database.select().from(vehicles).where(eq(vehicles.workshopId, workshopId)).orderBy(vehicles.plate);
    },
    async listServices(workshopId) {
      return database
        .select({
          id: serviceRecords.id,
          workshopId: serviceRecords.workshopId,
          customerId: serviceRecords.customerId,
          serviceCatalogId: serviceRecords.serviceCatalogId,
          customerName: customers.name,
          vehicleLabel: sql<string | null>`case when ${vehicles.id} is null then null else concat(${vehicles.make}, ' ', ${vehicles.model}, ' · ', ${vehicles.plate}) end`,
          description: serviceRecords.description,
          amountCents: serviceRecords.amountCents,
          completedAt: serviceRecords.completedAt,
          nextDueAt: serviceRecords.nextDueAt,
        })
        .from(serviceRecords)
        .innerJoin(customers, and(eq(customers.id, serviceRecords.customerId), eq(customers.workshopId, workshopId)))
        .leftJoin(vehicles, and(eq(vehicles.id, serviceRecords.vehicleId), eq(vehicles.workshopId, workshopId)))
        .where(eq(serviceRecords.workshopId, workshopId))
        .orderBy(desc(serviceRecords.completedAt));
    },
    async listServiceCatalog(workshopId) {
      return database.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.workshopId, workshopId)).orderBy(serviceCatalogItems.name);
    },
    async listInventory(workshopId) {
      return database.select().from(inventoryItems).where(eq(inventoryItems.workshopId, workshopId)).orderBy(inventoryItems.name);
    },
    async listContactEvents(workshopId) {
      return database.select().from(contactEvents).where(eq(contactEvents.workshopId, workshopId)).orderBy(desc(contactEvents.contactedAt));
    },
    async createCustomer(input) {
      const [row] = await database.insert(customers).values(input).returning();
      return row;
    },
    async createVehicle(input) {
      const [row] = await database.insert(vehicles).values(input).returning();
      return row;
    },
    async createServiceCatalogItem(input) {
      const [row] = await database.insert(serviceCatalogItems).values(input).returning();
      return row;
    },
    async recordService(input) {
      const [row] = await database.insert(serviceRecords).values(serviceValues(input)).returning();
      return row;
    },
    async consumeInventoryAtomically(input: ServiceWithInventoryInput) {
      return database.transaction(async (tx) => {
        const [service] = await tx.insert(serviceRecords).values(serviceValues(input)).returning();
        for (const consumption of input.inventory) {
          const [item] = await tx
            .update(inventoryItems)
            .set({ currentQuantity: sql`${inventoryItems.currentQuantity} - ${consumption.quantity}` })
            .where(and(
              eq(inventoryItems.workshopId, input.workshopId),
              eq(inventoryItems.id, consumption.inventoryItemId),
              gte(inventoryItems.currentQuantity, consumption.quantity),
            ))
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
        return service;
      });
    },
    async createInventoryItem(input) {
      const [row] = await database.insert(inventoryItems).values(input).returning();
      return row;
    },
    async adjustInventory(input) {
      return database.transaction(async (tx) => {
        const [row] = await tx
          .update(inventoryItems)
          .set({ currentQuantity: sql`${inventoryItems.currentQuantity} + ${input.delta}` })
          .where(and(
            eq(inventoryItems.workshopId, input.workshopId),
            eq(inventoryItems.id, input.inventoryItemId),
            gte(sql`${inventoryItems.currentQuantity} + ${input.delta}`, 0),
          ))
          .returning();
        if (!row) throw new Error(input.delta < 0 ? "Estoque insuficiente" : "Registro não encontrado");
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
      const [row] = await database.insert(contactEvents).values({ ...input, channel: "whatsapp" }).returning();
      return row;
    },
  };
}

export function createRepositoryForUrl(databaseUrl: string): CrmRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  return createDrizzleRepository(drizzle(pool));
}
