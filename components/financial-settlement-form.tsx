import { reverseFinancialEntrySettlementAction, settleFinancialEntryAction } from "../app/actions";
import { MoneyInput } from "./money-input";

type Account = { id: string; name: string };
type Settlement = { id: string; amountCents: number; reversedAt: Date | null; settledAt: Date };

function money(cents: number) { return (cents / 100).toFixed(2).replace(".", ","); }

export function FinancialSettlementForm({ financialEntryId, balanceCents, accounts, settlements }: { financialEntryId: string; balanceCents: number; accounts: Account[]; settlements: Settlement[] }) {
  return <details className="settlement-panel">
    <summary>Movimentações</summary>
    <div className="settlement-history">
      {settlements.map((settlement) => <div key={settlement.id} className={settlement.reversedAt ? "reversed" : ""}>
        <span><strong>{money(settlement.amountCents)}</strong><small>{settlement.settledAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}{settlement.reversedAt ? " · estornada" : ""}</small></span>
        {!settlement.reversedAt ? <form action={reverseFinancialEntrySettlementAction}><input type="hidden" name="financialEntryId" value={financialEntryId} /><input type="hidden" name="settlementId" value={settlement.id} /><button className="text-button danger-text" type="submit">Estornar</button></form> : null}
      </div>)}
    </div>
    {balanceCents > 0 ? <form action={settleFinancialEntryAction} className="settlement-form">
      <input type="hidden" name="financialEntryId" value={financialEntryId} />
      <label>Valor<MoneyInput name="amount" defaultValue={money(balanceCents)} required /></label>
      <label>Conta<select name="financialAccountId" defaultValue={accounts[0]?.id ?? ""}><option value="">Não informada</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
      <label>Forma<select name="paymentMethod" defaultValue="pix"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
      <button className="primary-button" type="submit">Registrar baixa</button>
    </form> : null}
  </details>;
}
