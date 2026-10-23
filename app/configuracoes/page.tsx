import { AppShell } from "../../components/app-shell";
import { readServerConfig } from "../../db/config";
import { getOwnerContext } from "../../server/owner-context";
import { ConfigurationPending } from "../configurar/page";
import { updateWorkshopSettingsAction } from "../actions";
import { FinancialSettingsForm } from "../../components/financial-settings-form";
import { getFinancialSettings } from "../../server/finance";

export default async function SettingsPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getOwnerContext();
  const financial = await getFinancialSettings(data.workshopId);
  return <AppShell workshopName={data.workshop.name} current="/configuracoes">
    <div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seu ambiente de trabalho.</h1><p>Informações da oficina e regras usadas nas previsões.</p></div></div>
    <section className="surface"><div className="section-title"><div><span>Identidade da oficina</span><h2>Dados usados na ordem impressa</h2></div></div><form action={updateWorkshopSettingsAction} className="form-grid">
      <label>Nome fantasia<input name="name" required defaultValue={data.workshop.name} /></label><label>Razão social<input name="legalName" defaultValue={data.workshop.legalName ?? ""} /></label>
      <label>CNPJ/CPF<input name="document" defaultValue={data.workshop.document ?? ""} /></label><label>Telefone<input name="phone" defaultValue={data.workshop.phone ?? ""} /></label>
      <label>WhatsApp atual<input name="whatsappNumber" defaultValue={data.workshop.whatsappNumber ?? ""} /></label><label>E-mail<input name="email" type="email" defaultValue={data.workshop.email ?? ""} /></label>
      <label className="span-2">Endereço<input name="addressStreet" defaultValue={data.workshop.addressStreet ?? ""} /></label><label>Número<input name="addressNumber" defaultValue={data.workshop.addressNumber ?? ""} /></label><label>Complemento<input name="addressComplement" defaultValue={data.workshop.addressComplement ?? ""} /></label>
      <label>Bairro<input name="addressDistrict" defaultValue={data.workshop.addressDistrict ?? ""} /></label><label>Cidade<input name="addressCity" defaultValue={data.workshop.addressCity ?? ""} /></label><label>UF<input name="addressState" maxLength={2} defaultValue={data.workshop.addressState ?? ""} /></label><label>CEP<input name="addressPostalCode" defaultValue={data.workshop.addressPostalCode ?? ""} /></label>
      <label>Cliente inativo após (dias)<input name="inactivityDays" type="number" min="30" max="730" defaultValue={data.workshop.inactivityDays} /></label>
      <label className="span-2">Termos da OS<textarea name="printTerms" rows={5} defaultValue={data.workshop.printTerms ?? ""} placeholder="Garantia, prazo para retirada e demais condições" /></label>
      <button className="primary-button" type="submit">Salvar configurações</button>
    </form></section>
    <FinancialSettingsForm settings={financial.settings} feeRules={financial.feeRules} />
    <section className="surface settings-list"><div><span>Proprietário</span><strong>{data.user.name}</strong><small>{data.user.email}</small></div><div><span>Acesso</span><strong>Exclusivo do proprietário</strong></div></section>
  </AppShell>;
}
