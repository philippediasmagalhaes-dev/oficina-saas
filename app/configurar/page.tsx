import { redirect } from "next/navigation";
import { createWorkshopAction } from "../actions";
import { readServerConfig, serverConfigKeys } from "../../db/config";
import { getOwnerUser } from "../../server/owner-context";
import { createDrizzleRepository } from "../../server/drizzle-repository";

type MissingKey = (typeof serverConfigKeys)[number];

export function ConfigurationPending({ missing }: { missing: MissingKey[] }) {
  return (
    <main className="auth-page">
      <section className="auth-card config-card">
        <img src="/logo.jpg" alt="Logo da oficina" className="auth-logo" />
        <p className="eyebrow">AMBIENTE SEGURO</p>
        <h1>Configuração pendente</h1>
        <p className="muted">O aplicativo foi publicado, mas precisa destas variáveis no ambiente da Vercel:</p>
        <ul>{missing.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
        <p className="config-note">Os valores secretos nunca são exibidos nesta tela.</p>
      </section>
    </main>
  );
}

export default async function ConfigurationPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const owner = await getOwnerUser();
  const existing = await createDrizzleRepository().getWorkshopForUser(owner.id);
  if (existing) redirect("/");
  return <main className="auth-page"><form action={createWorkshopAction} className="auth-card"><img src="/logo.jpg" alt="Logo da oficina" className="auth-logo" /><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Configure sua oficina</h1><p className="muted">Esse nome aparecerá no painel e nas mensagens de retorno.</p><label>Nome da oficina<input name="name" required minLength={2} placeholder="Ex.: Natinho Scooters" /></label><label>Considerar cliente inativo após<input name="inactivityDays" type="number" min="30" max="730" defaultValue="180" required /></label><button className="primary-button" type="submit">Criar ambiente</button></form></main>;
}
