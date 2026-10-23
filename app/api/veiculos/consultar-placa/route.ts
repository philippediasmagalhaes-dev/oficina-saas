import { getOwnerContext } from "../../../../server/owner-context";
import { configuredPlateProvider, lookupPlate } from "../../../../server/plate-lookup";

export async function GET(request: Request) {
  await getOwnerContext();
  const plate = new URL(request.url).searchParams.get("plate") ?? "";
  const configured = configuredPlateProvider(process.env);
  const result = await lookupPlate(plate, configured.provider, configured.name);
  return Response.json(result, { status: result.status === "not_found" ? 404 : 200, headers: { "Cache-Control": "private, max-age=3600" } });
}
