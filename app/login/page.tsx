import { redirect } from "next/navigation";
import { readServerConfig } from "../../db/config";
import { isFirstOwnerAvailable } from "../../server/owner-bootstrap";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string }>;
}) {
  if (!readServerConfig(process.env).configured) redirect("/configurar");
  const [firstAccessAvailable, params] = await Promise.all([
    isFirstOwnerAvailable(),
    searchParams,
  ]);
  return (
    <main className="auth-page">
      <LoginForm
        showFirstAccess={firstAccessAvailable}
        accountCreated={params.conta === "criada"}
      />
    </main>
  );
}
