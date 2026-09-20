import { notFound } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { CustomerEditForm } from "../../../../components/forms";
import { readServerConfig } from "../../../../db/config";
import { getCustomer } from "../../../../server/queries";
import { ConfigurationPending } from "../../../configurar/page";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getCustomer(id);
  if (!data.customer) notFound();

  return <AppShell workshopName={data.workshop.name} current="/clientes">
    <div className="page-heading"><div><a className="back-link" href="/clientes">← Voltar para clientes</a><p className="eyebrow">EDITAR CLIENTE</p><h1>{data.customer.name}</h1><p>Atualize contato, consentimento e observações sem perder o histórico de serviços.</p></div></div>
    <section className="surface edit-customer-card"><div className="section-title"><div><span>Cadastro</span><h2>Dados do cliente</h2></div></div><CustomerEditForm customer={data.customer} /></section>
  </AppShell>;
}
