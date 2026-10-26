import { closeCashSessionAction, createFinancialAccountAction, openCashSessionAction } from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { FinanceNav } from "../../../components/finance-nav";
import { MoneyInput } from "../../../components/money-input";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { getFinancialWorkspace } from "../../../server/queries";
import { ConfigurationPending } from "../../configurar/page";

export default async function CashPage() {
  const config = readServerConfig(process.env); if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const data = await getFinancialWorkspace({ status: "settled", pageSize: 25 });
  const openSessions = data.cashSessions.filter((session) => !session.closedAt);
  return <AppShell workshopName={data.workshop.name} current="/financeiro/caixa">
    <div className="page-heading"><div><p className="eyebrow">CAIXA</p><h1>Movimentação e conferência</h1><p>Abra o caixa, registre recebimentos e confira a diferença no fechamento.</p></div></div><FinanceNav current="/financeiro/caixa" />
    <section className="metric-grid finance-overview-metrics">{data.accounts.map((account) => <article className="metric-card" key={account.id}><span>{account.name}</span><strong>{formatCents(account.openingBalanceCents)}</strong><small>{account.type === "cash" ? "Dinheiro" : "Conta financeira"} · saldo inicial</small></article>)}</section>
    <div className="split-grid">
      <section className="surface"><div className="section-title"><div><span>Turno</span><h2>Abertura e fechamento</h2></div></div>
        {openSessions.length ? <div className="cash-session-list">{openSessions.map((session) => <form action={closeCashSessionAction} key={session.id} className="cash-session-card"><input type="hidden" name="cashSessionId" value={session.id} /><span><strong>Caixa aberto</strong><small>Desde {session.openedAt.toLocaleString("pt-BR")}</small></span><label>Saldo contado<MoneyInput name="declaredClosing" defaultValue="0,00" required /></label><label>Observação<input name="note" /></label><button className="primary-button" type="submit">Fechar caixa</button></form>)}</div> : <form action={openCashSessionAction} className="form-grid compact-form"><label>Conta<select name="financialAccountId" required>{data.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Saldo inicial<MoneyInput name="openingBalance" defaultValue="0,00" required /></label><button className="primary-button span-2" type="submit">Abrir caixa</button></form>}
      </section>
      <section className="surface"><div className="section-title"><div><span>Contas financeiras</span><h2>Adicionar conta</h2></div></div><form action={createFinancialAccountAction} className="form-grid compact-form"><label>Nome<input name="name" placeholder="Ex.: Banco, PIX ou maquininha" required /></label><label>Tipo<select name="type"><option value="cash">Dinheiro</option><option value="bank">Banco</option><option value="digital_wallet">Carteira digital</option><option value="card_clearing">Recebíveis de cartão</option></select></label><label>Saldo inicial<MoneyInput name="openingBalance" defaultValue="0,00" /></label><button className="secondary-button" type="submit">Criar conta</button></form></section>
    </div>
    <section className="surface"><div className="section-title"><div><span>Histórico</span><h2>Últimos fechamentos</h2></div></div><div className="table-wrap"><table><thead><tr><th>Abertura</th><th>Fechamento</th><th>Calculado</th><th>Informado</th><th>Diferença</th></tr></thead><tbody>{data.cashSessions.filter((session) => session.closedAt).map((session) => <tr key={session.id}><td>{session.openedAt.toLocaleString("pt-BR")}</td><td>{session.closedAt?.toLocaleString("pt-BR")}</td><td>{formatCents(session.calculatedClosingCents ?? 0)}</td><td>{formatCents(session.declaredClosingCents ?? 0)}</td><td>{formatCents((session.declaredClosingCents ?? 0) - (session.calculatedClosingCents ?? 0))}</td></tr>)}</tbody></table></div></section>
  </AppShell>;
}
