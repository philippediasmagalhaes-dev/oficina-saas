import { AppShell } from "../../components/app-shell";
import {
  CollaboratorEditForm,
  CollaboratorForm,
  CollaboratorRateEditor,
  CollaboratorRateForm,
  compensationModeLabels,
} from "../../components/collaborator-form";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { parseMonthPeriod } from "../../domain/dates";
import { formatCents } from "../../domain/money";
import { getCollaboratorsData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

const explanations = [
  ["Fixo mensal", "Um valor mensal previsto no financeiro, independentemente da quantidade de serviços."],
  ["Valor por serviço", "Um valor fixo para cada mão de obra atribuída ao colaborador."],
  ["Comissão percentual", "Percentual calculado somente sobre a mão de obra, já considerando desconto e participação."],
  ["Híbrido", "Combina fixo mensal com valor por serviço e/ou comissão percentual."],
] as const;

export default async function CollaboratorsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const { mes } = await searchParams;
  const period = parseMonthPeriod(mes);
  const data = await getCollaboratorsData(period);
  const payableTotal = data.payables.reduce((sum, row) => sum + row.totalCents, 0);
  const pendingTotal = data.payables.reduce((sum, row) => sum + row.pendingCents, 0);

  return (
    <AppShell workshopName={data.workshop.name} current="/colaboradores">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COLABORADORES</p>
          <h1>Remuneração clara, sem login adicional.</h1>
          <p>Configure cada profissional e acompanhe o que deve ser pago no mês.</p>
        </div>
        <a className="primary-button" href="#novo">Adicionar colaborador</a>
      </div>

      <section className="compensation-explainer" aria-label="Como funcionam as regras de remuneração">
        {explanations.map(([title, description]) => (
          <article key={title}>
            <strong>{title}</strong>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <span>{data.collaborators.length} cadastrados</span>
            <h2>Regras de remuneração</h2>
          </div>
        </div>
        {data.collaborators.length ? (
          <div className="collaborator-grid remuneration-grid">
            {data.collaborators.map((collaborator) => {
              const rates = data.rates.filter((rate) => rate.collaboratorId === collaborator.id);
              return (
                <article className="inventory-card remuneration-card" key={collaborator.id}>
                  <div className="inventory-top">
                    <div>
                      <span>{compensationModeLabels[collaborator.compensationMode]}</span>
                      <h3>{collaborator.name}</h3>
                    </div>
                    <b className={collaborator.active ? "ok" : ""}>{collaborator.active ? "Ativo" : "Inativo"}</b>
                  </div>
                  <div className="rule-summary-grid">
                    <span><small>Mensal</small><strong>{formatCents(collaborator.monthlyFixedCents)}</strong></span>
                    <span><small>Por serviço</small><strong>{formatCents(collaborator.fixedPerServiceCents)}</strong></span>
                    <span><small>Comissão</small><strong>{(collaborator.commissionBasisPoints / 100).toLocaleString("pt-BR")}%</strong></span>
                  </div>
                  <p className="field-hint">A comissão sempre incide somente sobre a mão de obra atribuída.</p>
                  <CollaboratorEditForm collaborator={collaborator} />
                  {collaborator.active ? <CollaboratorRateForm collaboratorId={collaborator.id} catalog={data.catalog} /> : null}
                  {rates.length ? (
                    <div className="specific-rate-list">
                      <small>Exceções por serviço</small>
                      {rates.map((rate) => <CollaboratorRateEditor key={rate.id} rate={rate} />)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhum colaborador" description="Cadastre quem executa os serviços para calcular a remuneração." />
        )}
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <span>Fechamento de {period.label}</span>
            <h2>Relatório para pagamento</h2>
          </div>
          <form method="get" className="month-filter">
            <input type="month" name="mes" defaultValue={period.value} aria-label="Mês do relatório" />
            <button className="secondary-button" type="submit">Aplicar</button>
          </form>
        </div>
        <div className="metric-grid compact-metrics commission-metrics">
          <article className="metric-card"><span>Total do mês</span><strong>{formatCents(payableTotal)}</strong><small>fixos e comissões</small></article>
          <article className="metric-card"><span>A pagar</span><strong>{formatCents(pendingTotal)}</strong><small>lançamentos ainda em aberto</small></article>
          <article className="metric-card"><span>Profissionais</span><strong>{data.payables.length}</strong><small>com remuneração no período</small></article>
        </div>
        {data.payables.length ? (
          <div className="commission-report">
            {data.payables.map((row) => (
              <div key={row.collaboratorId}>
                <span><strong>{row.collaboratorName}</strong><small>Comissão {formatCents(row.commissionCents)} · fixo {formatCents(row.fixedCents)}</small></span>
                <span><small>Pago {formatCents(row.settledCents)}</small><b>{formatCents(row.pendingCents)} a pagar</b><a className="table-link" href={`/financeiro?recognition=accrual&status=expected&collaborator=${row.collaboratorId}&from=${period.from.toISOString().slice(0, 10)}&to=${new Date(period.to.getTime() - 86400000).toISOString().slice(0, 10)}`}>Registrar pagamento</a></span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem remuneração no período" description="As comissões aparecem após a finalização financeira das ordens." />
        )}
      </section>

      <section className="surface" id="novo">
        <div className="section-title"><div><span>Novo cadastro</span><h2>Adicionar colaborador</h2></div></div>
        <CollaboratorForm />
      </section>
    </AppShell>
  );
}

