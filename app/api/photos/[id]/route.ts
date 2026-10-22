import { getOwnerContext } from "../../../../server/owner-context";
import { getServicePhoto } from "../../../../server/work-orders";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workshopId } = await getOwnerContext();
  const { id } = await params;
  const photo = await getServicePhoto(workshopId, id);
  if (photo.status === "missing") return new Response("Foto não encontrada", { status: 404 });
  if (photo.status === "unavailable") return new Response("Foto temporariamente indisponível", { status: 503 });
  return new Response(photo.body.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
