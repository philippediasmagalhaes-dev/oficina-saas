import { redirect } from "next/navigation";

export default async function LegacyVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/veiculos/${id}`);
}
