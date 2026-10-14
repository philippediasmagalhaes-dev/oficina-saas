import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  planOwnerIdentityRecovery,
  selectWorkshopForRecovery,
  type WorkshopDataCounts,
} from "../domain/owner-recovery";
import { closeDatabase, getDatabase } from "./client";
import {
  account,
  contactEvents,
  customers,
  inventoryItems,
  serviceCatalogItems,
  serviceRecords,
  session,
  user,
  vehicles,
  workshops,
} from "./schema";

const recoverySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(128),
});

type CountRow = { workshopId: string; total: number };

function countMap(rows: CountRow[]) {
  return new Map(rows.map((row) => [row.workshopId, Number(row.total)]));
}

function countFor(map: Map<string, number>, workshopId: string) {
  return map.get(workshopId) ?? 0;
}

async function main() {
  if (process.env.OWNER_RECOVERY_MODE !== "highest-data") {
    console.log("Recuperação do proprietário não solicitada.");
    return;
  }

  const parsed = recoverySchema.safeParse({
    email: process.env.OWNER_EMAIL,
    name: process.env.OWNER_NAME,
    password: process.env.OWNER_PASSWORD,
  });
  if (!parsed.success)
    throw new Error("Dados de recuperação do proprietário inválidos.");

  const passwordHash = await hashPassword(parsed.data.password);
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(73194623)`);

    const workshopRows = await transaction
      .select({
        id: workshops.id,
        ownerUserId: workshops.ownerUserId,
        updatedAt: workshops.updatedAt,
      })
      .from(workshops);
    if (workshopRows.length === 0)
      throw new Error("Nenhuma oficina foi encontrada para recuperação.");

    const customerRows = await transaction
      .select({ workshopId: customers.workshopId, total: count() })
      .from(customers)
      .groupBy(customers.workshopId);
    const vehicleRows = await transaction
      .select({ workshopId: vehicles.workshopId, total: count() })
      .from(vehicles)
      .groupBy(vehicles.workshopId);
    const serviceRows = await transaction
      .select({ workshopId: serviceRecords.workshopId, total: count() })
      .from(serviceRecords)
      .groupBy(serviceRecords.workshopId);
    const inventoryRows = await transaction
      .select({ workshopId: inventoryItems.workshopId, total: count() })
      .from(inventoryItems)
      .groupBy(inventoryItems.workshopId);
    const catalogRows = await transaction
      .select({ workshopId: serviceCatalogItems.workshopId, total: count() })
      .from(serviceCatalogItems)
      .groupBy(serviceCatalogItems.workshopId);
    const contactRows = await transaction
      .select({ workshopId: contactEvents.workshopId, total: count() })
      .from(contactEvents)
      .groupBy(contactEvents.workshopId);

    const counts = {
      customers: countMap(customerRows),
      vehicles: countMap(vehicleRows),
      serviceRecords: countMap(serviceRows),
      inventoryItems: countMap(inventoryRows),
      serviceCatalogItems: countMap(catalogRows),
      contactEvents: countMap(contactRows),
    } satisfies Record<keyof WorkshopDataCounts, Map<string, number>>;

    const selected = selectWorkshopForRecovery(
      workshopRows.map((workshop) => ({
        ...workshop,
        counts: {
          customers: countFor(counts.customers, workshop.id),
          vehicles: countFor(counts.vehicles, workshop.id),
          serviceRecords: countFor(counts.serviceRecords, workshop.id),
          inventoryItems: countFor(counts.inventoryItems, workshop.id),
          serviceCatalogItems: countFor(
            counts.serviceCatalogItems,
            workshop.id,
          ),
          contactEvents: countFor(counts.contactEvents, workshop.id),
        },
      })),
    );
    if (!selected) throw new Error("Nenhuma oficina pôde ser selecionada.");

    const users = await transaction
      .select({ id: user.id, email: user.email })
      .from(user);
    const selectedOwner = users.find(
      (candidate) => candidate.id === selected.ownerUserId,
    );
    if (!selectedOwner)
      throw new Error(
        "O proprietário da oficina selecionada não foi encontrado.",
      );

    const identityPlan = planOwnerIdentityRecovery({
      selectedOwner,
      users,
      desiredEmail: parsed.data.email,
    });

    if (identityPlan.displacedUser) {
      await transaction
        .update(user)
        .set({
          email: `recovery-${randomUUID()}@invalid.local`,
          updatedAt: new Date(),
        })
        .where(eq(user.id, identityPlan.displacedUser.id));
    }

    await transaction
      .update(user)
      .set({
        name: parsed.data.name,
        email: identityPlan.desiredEmail,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, identityPlan.selectedOwnerId));

    if (identityPlan.displacedUser) {
      await transaction
        .update(user)
        .set({
          email: identityPlan.displacedUser.replacementEmail,
          updatedAt: new Date(),
        })
        .where(eq(user.id, identityPlan.displacedUser.id));
    }

    const [credential] = await transaction
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, identityPlan.selectedOwnerId),
          eq(account.providerId, "credential"),
        ),
      )
      .limit(1);
    if (credential) {
      await transaction
        .update(account)
        .set({
          password: passwordHash,
          accountId: identityPlan.selectedOwnerId,
          updatedAt: new Date(),
        })
        .where(eq(account.id, credential.id));
    } else {
      await transaction.insert(account).values({
        id: randomUUID(),
        accountId: identityPlan.selectedOwnerId,
        providerId: "credential",
        userId: identityPlan.selectedOwnerId,
        password: passwordHash,
      });
    }

    await transaction
      .delete(session)
      .where(eq(session.userId, identityPlan.selectedOwnerId));
    console.log(
      `Acesso recuperado para a oficina com ${selected.score} registros de negócio.`,
    );
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
