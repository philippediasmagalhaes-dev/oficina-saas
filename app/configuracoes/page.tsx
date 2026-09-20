import { AppShell } from "../../components/app-shell";
import { readServerConfig } from "../../db/config";
import { getOwnerContext } from "../../server/owner-context";
import { ConfigurationPending } from "../configurar/page";

export default async function SettingsPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getOwnerContext();
  return <AppShell workshopName={data.workshop.name} current="/configuracoes">
    <div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seu ambiente de trabalho.</h1><p>Informações da oficina e regras usadas nas previsões.</p></div></div>
    <section className="surface settings-list"><div><span>Oficina</span><strong>{data.workshop.name}</strong></div><div><span>Proprietário</span><strong>{data.user.name}</strong><small>{data.user.email}</small></div><div><span>Cliente inativo após</span><strong>{data.workshop.inactivityDays} dias</strong></div><div><span>Acesso</span><strong>Exclusivo por convite</strong></div></section>
  </AppShell>;
}
