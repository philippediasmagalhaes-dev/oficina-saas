import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { parseFinancialPeriod } from "../../domain/service-filters";
import { getFinancialDashboard } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";
import { createManualFinancialEntryAction } from "../actions";

type SearchParams = {
  period?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  category?: string;
  recognition?: string;
  payment?: string;
  collaborator?: string;
};

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const params = await searchParams;
  const filters = {
    period: parseFinancialPeriod(params.period),
    query: params.q?.trim() ?? "",
    from: params.from ?? "",
    to: params.to ?? "",
    status: params.status ?? "",
    category: params.category ?? "",
    recognitionMode: params.recognition === "accrual" ? "accrual" as const : "cash" as const,
    paymentMethod: params.payment ?? "",
    collaboratorId: params.collaborator ?? "",
  };
  const data = await getFinancialDashboard(filters);
  const maxMonthlyRevenue = Math.max(
    ...data.snapshot.monthlyRevenue.map((month) => month.revenueCents),
    1,
  );

  return (
    <AppShell workshopName={data.workshop.name} current="/financeiro">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCEIRO</p>
          <h1>Receita visível, decisões mais seguras.</h1>
          <p>
            Consulte serviços concluídos por período, cliente, veículo ou tipo
            de serviço.
          </p>
        </div>
        <a className="primary-button" href="/ordens#nova">
          Abrir OS
        </a>
      </div>

      <section className="surface filter-surface">
        <form className="finance-filter" method="get">
          <label className="filter-search">
            Buscar
            <input
              name="q"
              defaultValue={filters.query}
              placeholder="Cliente, serviço ou veículo"
            />
          </label>
          <label>
            Período
            <select name="period" defaultValue={filters.period}>
              <option value="current_month">Mês atual</option>
              <option value="previous_month">Mês anterior</option>
              <option value="last_3_months">Últimos 3 meses</option>
              <option value="current_year">Ano atual</option>
              <option value="all">Todo o histórico</option>
            </select>
          </label>
          <label>
            De
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            Até
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <label>Visão<select name="recognition" defaultValue={filters.recognitionMode}><option value="cash">Caixa</option><option value="accrual">Competência</option></select></label>
          <label>Status<select name="status" defaultValue={filters.status}><option value="">Todos</option><option value="settled">Realizado</option><option value="expected">Previsto</option><option value="cancelled">Cancelado</option></select></label>
          <label>Categoria<select name="category" defaultValue={filters.category}><option value="">Todas</option><option value="service_income">Receita de serviço</option><option value="labor_compensation">Comissão</option><option value="fixed_payroll">Pagamento mensal</option><option value="tax_reserve">Reserva de imposto</option><option value="operational">Operacional</option></select></label>
          <label>Pagamento<select name="payment" defaultValue={filters.paymentMethod}><option value="">Todos</option><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="transfer">Transferência</option></select></label>
          <label>Colaborador<select name="collaborator" defaultValue={filters.collaboratorId}><option value="">Todos</option>{data.collaborators.map((collaborator) => <option key={collaborator.id} value={collaborator.id}>{collaborator.name}</option>)}</select></label>
          <div className="filter-actions">
            <button className="primary-button" type="submit">
              Aplicar filtros
            </button>
            <a className="secondary-button" href="/financeiro">
              Limpar
            </a>
          </div>
        </form>
        <p className="filter-hint">
          Datas preenchidas têm prioridade sobre o período rápido.
        </p>
      </section>

      <section className="metric-grid finance-metrics ledger-metrics">
        <article className="metric-card featured"><span>Entradas líquidas</span><strong>{formatCents(data.ledger.incomeCents)}</strong><small>já descontadas as taxas</small></article>
        <article className="metric-card"><span>Saídas</span><strong>{formatCents(data.ledger.expenseCents)}</strong><small>comissões e despesas</small></article>
        <article className="metric-card"><span>Impostos separados</span><strong>{formatCents(data.ledger.reserveCents)}</strong><small>provisão, não caixa livre</small></article>
        <article className="metric-card"><span>Saldo gerencial</span><strong>{formatCents(data.ledger.balanceCents)}</strong><small>{filters.recognitionMode === "cash" ? "regime de caixa" : "regime de competência"}</small></article>
      </section>

      <div className="split-grid">
        <section className="surface"><div className="section-title"><div><span>Contas a receber e pagar</span><h2>Livro financeiro</h2></div></div>{data.entries.length ? <div className="finance-list">{data.entries.slice(0, 30).map((entry) => <div key={entry.id}><span><strong>{entry.description}</strong><small>{entry.category.replaceAll("_", " ")} · {entry.status === "settled" ? "realizado" : "previsto"} · {entry.competenceDate.toLocaleDateString("pt-BR")}</small></span><b className={entry.direction === "income" ? "ok" : "warning"}>{entry.direction === "income" ? "+" : "−"}{formatCents(entry.netAmountCents)}</b></div>)}</div> : <EmptyState title="Sem lançamentos" description="Finalize uma OS ou registre uma conta manual." />}</section>
        <section className="surface"><div className="section-title"><div><span>Entrada manual</span><h2>Receita ou despesa</h2></div></div><form action={createManualFinancialEntryAction} className="form-grid compact-form">
          <label>Tipo<select name="direction" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option><option value="reserve">Reserva</option></select></label>
          <label>Categoria<input name="category" defaultValue="operational" required /></label>
          <label className="span-2">Descrição<input name="description" required placeholder="Ex.: aluguel, fornecedor, receita avulsa" /></label>
          <label>Valor<input name="amount" inputMode="decimal" required placeholder="0,00" /></label>
          <label>Competência<input name="competenceDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>Vencimento<input name="dueDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label className="checkbox-label"><input name="settled" type="checkbox" /> Já realizado</label>
          <label className="checkbox-label"><input name="recurringMonthly" type="checkbox" /> Recorrente mensal</label>
          <button className="secondary-button span-2" type="submit">Adicionar lançamento</button>
        </form></section>
      </div>

      <div className="filter-result">
        <span>
          {data.periodLabel}
          {filters.query ? ` · busca por “${filters.query}”` : ""}
        </span>
        <strong>
          {data.services.length} {data.services.length === 1 ? "resultado" : "resultados"}
        </strong>
      </div>

      <section className="metric-grid finance-metrics">
        <article className="metric-card featured">
          <span>Receita no período</span>
          <strong>{formatCents(data.snapshot.totalRevenueCents)}</strong>
          <small>valor dos serviços filtrados</small>
        </article>
        <article className="metric-card">
          <span>Ticket médio</span>
          <strong>{formatCents(data.snapshot.averageTicketCents)}</strong>
          <small>por serviço no período</small>
        </article>
        <article className="metric-card">
          <span>Serviços</span>
          <strong>{data.snapshot.serviceCount}</strong>
          <small>lançamentos encontrados</small>
        </article>
        <article className="metric-card">
          <span>Clientes</span>
          <strong>{data.customerCount}</strong>
          <small>atendidos no período</small>
        </article>
      </section>

      <section className="surface">
        <div className="section-title">
          <div>
            <span>Últimos 6 meses</span>
            <h2>Evolução dentro do filtro</h2>
          </div>
        </div>
        {data.snapshot.serviceCount ? (
          <div className="revenue-chart">
            {data.snapshot.monthlyRevenue.map((month) => (
              <div className="revenue-row" key={month.key}>
                <span>{month.label}</span>
                <div className="revenue-track">
                  <i
                    style={{
                      width: `${Math.max(
                        (month.revenueCents / maxMonthlyRevenue) * 100,
                        month.revenueCents ? 4 : 0,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{formatCents(month.revenueCents)}</strong>
                <small>{month.serviceCount} serv.</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum resultado"
            description="Ajuste os filtros ou registre um novo serviço."
            action="Limpar filtros"
            href="/financeiro"
          />
        )}
      </section>

      <div className="split-grid">
        <section className="surface">
          <div className="section-title">
            <div>
              <span>Composição filtrada</span>
              <h2>Serviços por receita</h2>
            </div>
          </div>
          {data.snapshot.topServices.length ? (
            <div className="ranking-list">
              {data.snapshot.topServices.map((service, index) => (
                <div className="ranking-row" key={service.name}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{service.name}</strong>
                    <small>
                      {service.serviceCount}{" "}
                      {service.serviceCount === 1
                        ? "atendimento"
                        : "atendimentos"}
                    </small>
                  </div>
                  <b>{formatCents(service.revenueCents)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem serviços no filtro"
              description="O ranking será atualizado conforme os resultados."
            />
          )}
        </section>

        <section className="surface">
          <div className="section-title">
            <div>
              <span>Resultados</span>
              <h2>Entradas encontradas</h2>
            </div>
            <a href="/ordens">Ver ordens</a>
          </div>
          {data.services.length ? (
            <div className="finance-list">
              {data.services.slice(0, 12).map((service) => (
                <div key={service.id}>
                  <span>
                    <a
                      className="finance-entry-link"
                      href={`/ordens/${service.id}`}
                    >
                      {service.description}
                    </a>
                    <small>
                      {service.customerName} · {service.completedAt.toLocaleDateString("pt-BR")}
                    </small>
                  </span>
                  <b>{formatCents(service.amountCents)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma entrada"
              description="Não encontramos serviços com os filtros informados."
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
