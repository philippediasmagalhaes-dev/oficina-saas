import { AppShell } from "../../../components/app-shell";
import { FinanceNav } from "../../../components/finance-nav";
import { FinancialEntryForm } from "../../../components/financial-entry-form";
import { FinancialEntryTable } from "../../../components/financial-entry-table";
import { PaginationNav } from "../../../components/pagination-nav";
import { readServerConfig } from "../../../db/config";
import { getFinancialWorkspace } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

type Params = { q?: string; status?: string; due?: string; page?: string };
export default async function PayablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const config = readServerConfig(process.env); if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const params = await searchParams;
  const data = await getFinancialWorkspace({ direction: "expense", search: params.q, status: params.status, due: params.due, page: params.page, pageSize: 25 });
  return <AppShell workshopName={data.workshop.name} current="/financeiro/pagar">
    <div className="page-heading"><div><p className="eyebrow">CONTAS A PAGAR</p><h1>Compromissos da oficina</h1><p>Fornecedores, despesas, parcelas e datas de pagamento.</p></div></div><FinanceNav current="/financeiro/pagar" />
    <section className="surface filter-surface"><form className="finance-operations-filter"><label>Buscar<input name="q" defaultValue={params.q ?? ""} placeholder="Fornecedor, descrição ou documento" /></label><label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Todos</option><option value="expected">Em aberto</option><option value="partial">Parcial</option><option value="settled">Liquidado</option></select></label><label>Vencimento<select name="due" defaultValue={params.due ?? ""}><option value="">Qualquer data</option><option value="overdue">Vencidos</option><option value="today">Hoje</option><option value="next_7_days">Próximos 7 dias</option><option value="next_30_days">Próximos 30 dias</option></select></label><button className="primary-button" type="submit">Filtrar</button></form></section>
    <section className="surface compact-list-surface"><div className="section-title"><div><span>{data.entries.total} títulos</span><h2>Contas a pagar</h2></div></div><FinancialEntryTable entries={data.entries.items} settlements={data.settlements} accounts={data.accounts} /><PaginationNav pathname="/financeiro/pagar" query={params.q ?? ""} page={data.entries.page} pageCount={data.entries.totalPages} previousPage={data.entries.page > 1 ? data.entries.page - 1 : null} nextPage={data.entries.page < data.entries.totalPages ? data.entries.page + 1 : null} extra={{ status: params.status, due: params.due }} /></section>
    <section className="surface finance-entry-panel" id="novo"><div className="section-title"><div><span>Novo título</span><h2>Adicionar conta a pagar</h2></div></div><FinancialEntryForm categories={data.categories} suppliers={data.suppliers} accounts={data.accounts} defaultDirection="expense" /></section>
  </AppShell>;
}
