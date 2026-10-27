import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { createDatabase, runDatabaseTransactionForUrl } from "../db/client";
import { customers, serviceRecords, workshops } from "../db/schema";
import { distributeMissingCompletionDates } from "../domain/pilot-data-normalization";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

const apply = process.argv.includes("--apply");
const requestedWorkshopId = process.argv.find((argument) => argument.startsWith("--workshop-id="))?.split("=")[1];
const database = createDatabase(databaseUrl);
const workshopRows = await database.select({ id: workshops.id, name: workshops.name }).from(workshops);
const selected = requestedWorkshopId
  ? workshopRows.find((workshop) => workshop.id === requestedWorkshopId)
  : workshopRows.length === 1 ? workshopRows[0] : undefined;
if (!selected) throw new Error("Informe --workshop-id quando houver mais de uma oficina na base.");

const [customerStats] = await database.select({
  total: sql<number>`count(*)::integer`,
  withoutConsent: sql<number>`count(*) filter (where ${customers.whatsappConsent} = false)::integer`,
  toNormalize: sql<number>`count(*) filter (where ${customers.whatsappConsent} = false or ${customers.whatsappConsentAt} is null or ${customers.whatsappConsentSource} is null)::integer`,
  optedOut: sql<number>`count(*) filter (where ${customers.whatsappOptOutAt} is not null)::integer`,
}).from(customers).where(eq(customers.workshopId, selected.id));
const [orderStats] = await database.select({
  total: sql<number>`count(*)::integer`,
  notCompleted: sql<number>`count(*) filter (where ${serviceRecords.status} <> 'completed')::integer`,
  missingDate: sql<number>`count(*) filter (where ${serviceRecords.completedAt} is null)::integer`,
}).from(serviceRecords).where(eq(serviceRecords.workshopId, selected.id));
const missingOrders = await database.select({ id: serviceRecords.id }).from(serviceRecords)
  .where(and(eq(serviceRecords.workshopId, selected.id), isNull(serviceRecords.completedAt)));
const completionDates = distributeMissingCompletionDates(missingOrders.map((order) => order.id), new Date());

console.log(JSON.stringify({
  mode: apply ? "apply" : "preview",
  workshop: selected,
  customers: customerStats,
  serviceRecords: orderStats,
  generatedMonths: [...completionDates.values()].reduce<Record<string, number>>((months, date) => {
    const key = date.toISOString().slice(0, 7);
    months[key] = (months[key] ?? 0) + 1;
    return months;
  }, {}),
}, null, 2));

if (!apply) {
  console.log("Prévia concluída. Execute novamente com --apply para gravar.");
  process.exit(0);
}

await runDatabaseTransactionForUrl(databaseUrl, async (transaction) => {
  await transaction.update(customers).set({
    whatsappConsent: true,
    whatsappConsentAt: sql`coalesce(${customers.whatsappConsentAt}, now())`,
    whatsappConsentSource: sql`coalesce(${customers.whatsappConsentSource}, 'pilot_owner_confirmation')`,
    updatedAt: new Date(),
  }).where(and(
    eq(customers.workshopId, selected.id),
    or(eq(customers.whatsappConsent, false), isNull(customers.whatsappConsentAt), isNull(customers.whatsappConsentSource)),
  ));

  await transaction.update(serviceRecords).set({ status: "completed", updatedAt: new Date() })
    .where(and(eq(serviceRecords.workshopId, selected.id), ne(serviceRecords.status, "completed")));

  for (const [id, completedAt] of completionDates) {
    await transaction.update(serviceRecords).set({ completedAt, updatedAt: new Date() })
      .where(and(eq(serviceRecords.workshopId, selected.id), eq(serviceRecords.id, id), isNull(serviceRecords.completedAt)));
  }
});

const [verifiedCustomers] = await database.select({
  total: sql<number>`count(*)::integer`,
  consented: sql<number>`count(*) filter (where ${customers.whatsappConsent} = true)::integer`,
  optedOut: sql<number>`count(*) filter (where ${customers.whatsappOptOutAt} is not null)::integer`,
}).from(customers).where(eq(customers.workshopId, selected.id));
const [verifiedOrders] = await database.select({
  total: sql<number>`count(*)::integer`,
  completed: sql<number>`count(*) filter (where ${serviceRecords.status} = 'completed')::integer`,
  missingDate: sql<number>`count(*) filter (where ${serviceRecords.completedAt} is null)::integer`,
}).from(serviceRecords).where(eq(serviceRecords.workshopId, selected.id));
console.log(JSON.stringify({ verified: { customers: verifiedCustomers, serviceRecords: verifiedOrders } }, null, 2));
