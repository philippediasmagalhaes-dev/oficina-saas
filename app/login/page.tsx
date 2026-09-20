import { redirect } from "next/navigation";
import { readServerConfig } from "../../db/config";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (!readServerConfig(process.env).configured) redirect("/configurar");
  return <main className="auth-page"><LoginForm /></main>;
}
