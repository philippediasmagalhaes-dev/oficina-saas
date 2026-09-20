import { redirect } from "next/navigation";

export default async function LegacyServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/ordens/${id}`);
}
