import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "../../../../db/client";
import { businessFinExports, financialEntries } from "../../../../db/schema";
import { selectBusinessFinEntries, toBusinessFinCsv } from "../../../../domain/business-fin";
import { listFinancialEntries } from "../../../../server/finance";
import { getOwnerContext } from "../../../../server/owner-context";

function dateParam(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function GET(request: Request) {
  const { workshopId } = await getOwnerContext();
  const url = new URL(request.url);
  const includeExported = url.searchParams.get("includeExported") === "1";
  const entries = await listFinancialEntries(workshopId, { from: dateParam(url.searchParams.get("from")), to: dateParam(url.searchParams.get("to"), true), recognitionMode: "accrual" });
  const exported = entries.length ? await getDatabase().select({ externalId: businessFinExports.externalId }).from(businessFinExports).where(and(eq(businessFinExports.workshopId, workshopId), inArray(businessFinExports.financialEntryId, entries.map((entry) => entry.id)))) : [];
  const selected = selectBusinessFinEntries(entries, new Set(exported.map((entry) => entry.externalId)), includeExported);
  const csv = toBusinessFinCsv(selected);
  if (!includeExported && selected.length) {
    await getDatabase().insert(businessFinExports).values(selected.map((entry) => ({ workshopId, financialEntryId: entry.id, externalId: entry.externalId }))).onConflictDoNothing();
  }
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="business-fin-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Exported-Rows": String(selected.length) } });
}
