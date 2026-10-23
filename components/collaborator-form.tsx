import { createCollaboratorAction, setCollaboratorServiceRateAction } from "../app/actions";
import type { ServiceCatalogSummary } from "../server/ports";

export function CollaboratorForm() {
  return <form action={createCollaboratorAction} className="form-grid">
    <label>Nome<input name="name" required /></label><label>Telefone<input name="phone" inputMode="tel" /></label>
    <label>Modelo<select name="compensationMode" defaultValue="percentage"><option value="percentage">Comissão percentual</option><option value="fixed_per_service">Valor por serviço</option><option value="fixed_monthly">Fixo mensal</option><option value="hybrid">Híbrido</option></select></label>
    <label>Fixo mensal (R$)<input name="monthlyFixed" inputMode="decimal" defaultValue="0,00" /></label>
    <label>Valor por serviço (R$)<input name="fixedPerService" inputMode="decimal" defaultValue="0,00" /></label>
    <label>Comissão sobre mão de obra (%)<input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="0" /></label>
    <button className="primary-button" type="submit">Cadastrar colaborador</button>
  </form>;
}

export function CollaboratorRateForm({ collaboratorId, catalog }: { collaboratorId: string; catalog: ServiceCatalogSummary[] }) {
  return <form action={setCollaboratorServiceRateAction} className="inline-form collaborator-rate-form">
    <input type="hidden" name="collaboratorId" value={collaboratorId} />
    <select name="serviceCatalogId" required defaultValue=""><option value="" disabled>Serviço específico</option>{catalog.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
    <input name="fixedPerService" inputMode="decimal" placeholder="Fixo R$" aria-label="Valor fixo específico" />
    <input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="%" aria-label="Comissão específica" />
    <button className="secondary-button" type="submit">Salvar regra</button>
  </form>;
}
