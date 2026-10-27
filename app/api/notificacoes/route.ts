import { getOwnerContext } from "../../../server/owner-context";
import { listApprovalNotifications } from "../../../server/notifications";

export async function GET() {
  const { workshopId } = await getOwnerContext();
  return Response.json(await listApprovalNotifications(workshopId), { headers: { "Cache-Control": "private, no-store" } });
}
