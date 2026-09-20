import { getOwnerContext } from "../../../../server/owner-context";
import { getServicePhoto } from "../../../../server/work-orders";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workshopId } = await getOwnerContext();
  const { id } = await params;
  const photo = await getServicePhoto(workshopId, id);
  if (!photo) return new Response("Foto não encontrada", { status: 404 });
  return new Response(Buffer.from(photo.dataBase64, "base64"), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
