import { getOwnerContext } from "../../../../server/owner-context";

export async function GET(request: Request) {
  const { workshopId, repository } = await getOwnerContext();
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const result = await repository.listCustomersPage(workshopId, { query: q, page: 1, pageSize: 20 });
  return Response.json(result.items.map(({ id, name, phone }) => ({ id, name, phone })), { headers: { "Cache-Control": "private, no-store" } });
}
