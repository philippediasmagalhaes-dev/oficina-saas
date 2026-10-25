import {
  createCollaboratorAction,
  deactivateCollaboratorAction,
  deleteCollaboratorServiceRateAction,
  setCollaboratorServiceRateAction,
  updateCollaboratorAction,
} from "../app/actions";
import type { ServiceCatalogSummary } from "../server/ports";

export const compensationModeLabels = {
  fixed_monthly: "Fixo mensal",
  fixed_per_service: "Valor por serviço",
  percentage: "Comissão percentual",
  hybrid: "Híbrido",
} as const;

type CollaboratorValues = {
  id: string;
  name: string;
  phone: string | null;
  compensationMode: keyof typeof compensationModeLabels;
  monthlyFixedCents: number;
  fixedPerServiceCents: number;
  commissionBasisPoints: number;
  active: boolean;
};

function money(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function CompensationFields({ collaborator }: { collaborator?: CollaboratorValues }) {
  return (
    <>
      <label>
        Nome<input name="name" required defaultValue={collaborator?.name} />
      </label>
      <label>
        Telefone<input name="phone" inputMode="tel" defaultValue={collaborator?.phone ?? ""} />
      </label>
      <label>
        Modelo
        <select name="compensationMode" defaultValue={collaborator?.compensationMode ?? "percentage"}>
          {Object.entries(compensationModeLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        Fixo mensal (R$)
        <input name="monthlyFixed" inputMode="decimal" defaultValue={money(collaborator?.monthlyFixedCents ?? 0)} />
      </label>
      <label>
        Valor por serviço (R$)
        <input name="fixedPerService" inputMode="decimal" defaultValue={money(collaborator?.fixedPerServiceCents ?? 0)} />
      </label>
      <label>
        Comissão sobre mão de obra (%)
        <input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={(collaborator?.commissionBasisPoints ?? 0) / 100} />
      </label>
    </>
  );
}

export function CollaboratorForm() {
  return (
    <form action={createCollaboratorAction} className="form-grid">
      <CompensationFields />
      <button className="primary-button" type="submit">Cadastrar colaborador</button>
    </form>
  );
}

export function CollaboratorEditForm({ collaborator }: { collaborator: CollaboratorValues }) {
  return (
    <details className="rule-editor">
      <summary>Editar regra principal</summary>
      <form action={updateCollaboratorAction} className="form-grid compact-form">
        <input type="hidden" name="collaboratorId" value={collaborator.id} />
        <CompensationFields collaborator={collaborator} />
        <button className="secondary-button" type="submit">Salvar alterações</button>
      </form>
      {collaborator.active ? (
        <form action={deactivateCollaboratorAction} className="danger-zone">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <button className="text-button" type="submit">Desativar colaborador</button>
          <small>O histórico e as comissões já fechadas serão preservados.</small>
        </form>
      ) : null}
    </details>
  );
}

export function CollaboratorRateForm({ collaboratorId, catalog }: { collaboratorId: string; catalog: ServiceCatalogSummary[] }) {
  return (
    <form action={setCollaboratorServiceRateAction} className="inline-form collaborator-rate-form">
      <input type="hidden" name="collaboratorId" value={collaboratorId} />
      <select name="serviceCatalogId" required defaultValue="">
        <option value="" disabled>Serviço específico</option>
        {catalog.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      <input name="fixedPerService" inputMode="decimal" placeholder="Fixo R$" aria-label="Valor fixo específico" />
      <input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="%" aria-label="Comissão específica" />
      <button className="secondary-button" type="submit">Adicionar regra</button>
    </form>
  );
}

export function CollaboratorRateEditor({
  rate,
}: {
  rate: {
    id: string;
    collaboratorId: string;
    serviceCatalogId: string;
    serviceName: string;
    fixedPerServiceCents: number | null;
    commissionBasisPoints: number | null;
  };
}) {
  return (
    <div className="specific-rate-row">
      <form action={setCollaboratorServiceRateAction} className="inline-form collaborator-rate-form">
        <input type="hidden" name="collaboratorId" value={rate.collaboratorId} />
        <input type="hidden" name="serviceCatalogId" value={rate.serviceCatalogId} />
        <strong>{rate.serviceName}</strong>
        <input name="fixedPerService" inputMode="decimal" aria-label={`Valor fixo para ${rate.serviceName}`} defaultValue={rate.fixedPerServiceCents === null ? "" : money(rate.fixedPerServiceCents)} placeholder="padrão" />
        <input name="commissionPercent" type="number" min="0" max="100" step="0.01" aria-label={`Comissão para ${rate.serviceName}`} defaultValue={rate.commissionBasisPoints === null ? "" : rate.commissionBasisPoints / 100} placeholder="padrão %" />
        <button className="text-button" type="submit">Salvar</button>
      </form>
      <form action={deleteCollaboratorServiceRateAction}>
        <input type="hidden" name="rateId" value={rate.id} />
        <button className="text-button danger-text" type="submit">Excluir</button>
      </form>
    </div>
  );
}

