import { AppShell } from "../../components/app-shell";
import { CollaboratorForm, CollaboratorRateForm } from "../../components/collaborator-form";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getCollaboratorsData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

const modeLabels = { fixed_monthly: "Fixo mensal", fixed_per_service: "Valor por serviço", percentage: "Comissão percentual", hybrid: "Híbrido" } as const;

export default async function CollaboratorsPage() {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getCollaboratorsData();
  return <AppShell workshopName={data.workshop.name} current="/colaboradores">
    <div className="page-heading"><div><p className="eyebrow">COLABORADORES</p><h1>Equipe registrada, sem login adicional.</h1><p>Configure valores fixos e comissões aplicadas somente à mão de obra.</p></div></div>
    <section className="surface"><div className="section-title"><div><span>Novo cadastro</span><h2>Adicionar colaborador</h2></div></div><CollaboratorForm /></section>
    <section className="surface"><div className="section-title"><div><span>{data.collaborators.length} cadastrados</span><h2>Regras de remuneração</h2></div></div>{data.collaborators.length ? <div className="collaborator-grid">{data.collaborators.map((collaborator) => <article className="inventory-card" key={collaborator.id}><div className="inventory-top"><div><span>{modeLabels[collaborator.compensationMode]}</span><h3>{collaborator.name}</h3></div><b className={collaborator.active ? "ok" : ""}>{collaborator.active ? "Ativo" : "Inativo"}</b></div><p>Mensal {formatCents(collaborator.monthlyFixedCents)} · por serviço {formatCents(collaborator.fixedPerServiceCents)} · comissão {(collaborator.commissionBasisPoints / 100).toLocaleString("pt-BR")}%</p><CollaboratorRateForm collaboratorId={collaborator.id} catalog={data.catalog} />{data.rates.filter((rate) => rate.collaboratorId === collaborator.id).map((rate) => <small key={rate.id}>{rate.serviceName}: {rate.fixedPerServiceCents === null ? "padrão" : formatCents(rate.fixedPerServiceCents)} + {rate.commissionBasisPoints === null ? "padrão" : `${rate.commissionBasisPoints / 100}%`}</small>)}</article>)}</div> : <EmptyState title="Nenhum colaborador" description="Cadastre quem executa os serviços para calcular a remuneração." />}</section>
  </AppShell>;
}
