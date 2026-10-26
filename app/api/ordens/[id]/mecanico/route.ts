import { getOwnerContext } from "../../../../../server/owner-context";
import { getWorkOrder } from "../../../../../server/work-orders";
import { signMechanicAccess } from "../../../../../server/mechanic-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workshopId } = await getOwnerContext();
  const { id } = await params;
  const order = await getWorkOrder(workshopId, id);
  if (!order) return new Response("OS não encontrada.", { status: 404 });
  const token = await signMechanicAccess({ workshopId, serviceRecordId: id }, process.env.BETTER_AUTH_SECRET!);
  return Response.redirect(new URL(`/mecanico/${token}`, request.url), 303);
}
