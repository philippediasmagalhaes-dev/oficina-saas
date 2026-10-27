import { and, eq } from "drizzle-orm";
import { getDatabase } from "../../../../db/client";
import { vehicles } from "../../../../db/schema";
import { getOwnerContext } from "../../../../server/owner-context";

export async function GET(request: Request) {
  const { workshopId } = await getOwnerContext();
  const customerId = new URL(request.url).searchParams.get("customerId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) return Response.json([], { status: 400 });
  const rows = await getDatabase().select({ id: vehicles.id, workshopId: vehicles.workshopId, customerId: vehicles.customerId, plate: vehicles.plate, make: vehicles.make, model: vehicles.model }).from(vehicles).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.customerId, customerId))).orderBy(vehicles.plate).limit(50);
  return Response.json(rows, { headers: { "Cache-Control": "private, no-store" } });
}
