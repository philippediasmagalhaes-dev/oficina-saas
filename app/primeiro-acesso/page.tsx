import { redirect } from "next/navigation";
import { readServerConfig } from "../../db/config";
import { isFirstOwnerAvailable } from "../../server/owner-bootstrap";
import { FirstAccessForm } from "./first-access-form";

export const dynamic = "force-dynamic";

export default async function FirstAccessPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) redirect("/configurar");
  if (!(await isFirstOwnerAvailable())) redirect("/login");
  return (
    <main className="auth-page">
      <FirstAccessForm />
    </main>
  );
}
