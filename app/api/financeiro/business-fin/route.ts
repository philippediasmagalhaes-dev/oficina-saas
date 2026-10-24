import { toBusinessFinCsv } from "../../../../domain/business-fin";
import { parseFinancialPeriod, resolveFinancialPeriodBounds } from "../../../../domain/service-filters";
import { claimBusinessFinEntries, listFinancialEntries } from "../../../../server/finance";
import { getOwnerContext } from "../../../../server/owner-context";

export async function GET(request: Request) {
  const { workshopId } = await getOwnerContext();
  const url = new URL(request.url);
  const includeExported = url.searchParams.get("includeExported") === "1";
  const period = parseFinancialPeriod(url.searchParams.get("period") ?? undefined);
  const { start, end } = resolveFinancialPeriodBounds({ period, from: url.searchParams.get("from") ?? "", to: url.searchParams.get("to") ?? "" });
  const filters = {
    from: start ?? undefined,
    to: end ?? undefined,
    recognitionMode: url.searchParams.get("recognition") === "cash" ? "cash" as const : "accrual" as const,
    status: url.searchParams.get("status") || undefined,
    category: url.searchParams.get("category") || undefined,
    paymentMethod: url.searchParams.get("payment") || undefined,
    collaboratorId: url.searchParams.get("collaborator") || undefined,
  };
  const entries = includeExported ? await listFinancialEntries(workshopId, filters) : await claimBusinessFinEntries(workshopId, filters);
  const csv = toBusinessFinCsv(entries);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="business-fin-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Exported-Rows": String(entries.length) } });
}
