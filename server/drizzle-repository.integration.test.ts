import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import { createDrizzleRepository } from "./drizzle-repository";

describe("Drizzle repository", () => {
  const run = process.env.TEST_DATABASE_URL ? it : it.skip;
  run("records a service and inventory movement atomically", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL! });
    const db = drizzle({ client: pool, schema });
    const repository = createDrizzleRepository(db);
    const userId = `test-${randomUUID()}`;
    await db.insert(schema.user).values({ id: userId, name: "Teste", email: `${userId}@example.com`, emailVerified: true });
    try {
      const workshop = await repository.createWorkshop({ ownerUserId: userId, name: "Oficina Teste", inactivityDays: 180 });
      const customer = await repository.createCustomer({ workshopId: workshop.id, name: "Cliente", phone: null, email: null, whatsappConsent: false, notes: null });
      const item = await repository.createInventoryItem({ workshopId: workshop.id, sku: null, name: "Filtro", unit: "un", costCents: 1000, salePriceCents: 2000, currentQuantity: 2, minimumQuantity: 1 });
      await repository.consumeInventoryAtomically({ workshopId: workshop.id, customerId: customer.id, vehicleId: null, description: "Revisão", amountCents: 10000, completedAt: new Date(), odometer: null, notes: null, returnIntervalDays: null, nextDueAt: null, inventory: [{ inventoryItemId: item.id, quantity: 1 }] });
      const [stock] = await db.select({ quantity: schema.inventoryItems.currentQuantity }).from(schema.inventoryItems).where(eq(schema.inventoryItems.id, item.id));
      const services = await repository.listServices(workshop.id);
      expect(stock.quantity).toBe(1);
      expect(services).toHaveLength(1);
    } finally {
      await db.delete(schema.user).where(eq(schema.user.id, userId));
      await pool.end();
    }
  });
});
