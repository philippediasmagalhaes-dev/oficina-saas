import { formatCents } from "../domain/money";
import { FinancialSettlementForm } from "./financial-settlement-form";

type Entry = {
  id: string; description: string; direction: "income" | "expense" | "reserve"; category: string;
  grossAmountCents: number; dueDate: Date; status: "expected" | "partial" | "settled" | "cancelled";
  installmentNumber: number; installmentCount: number; documentNumber: string | null;
};
type Settlement = { id: string; financialEntryId: string; amountCents: number; reversedAt: Date | null; settledAt: Date };
type Account = { id: string; name: string };

const labels = { expected: "Em aberto", partial: "Parcial", settled: "Liquidado", cancelled: "Cancelado" } as const;

export function FinancialEntryTable({ entries, settlements, accounts }: { entries: Entry[]; settlements: Settlement[]; accounts: Account[] }) {
  return <div className="table-wrap finance-entry-table"><table>
    <thead><tr><th>Título</th><th>Vencimento</th><th>Status</th><th>Total</th><th>Pago</th><th>Saldo</th><th></th></tr></thead>
    <tbody>{entries.map((entry) => {
      const entrySettlements = settlements.filter((settlement) => settlement.financialEntryId === entry.id);
      const paidCents = entrySettlements.filter((settlement) => !settlement.reversedAt).reduce((sum, settlement) => sum + settlement.amountCents, 0);
      const balanceCents = Math.max(entry.grossAmountCents - paidCents, 0);
      return <tr key={entry.id}>
        <td><strong>{entry.description}</strong><small>{entry.documentNumber ?? entry.category.replaceAll("_", " ")}{entry.installmentCount > 1 ? ` · ${entry.installmentNumber}/${entry.installmentCount}` : ""}</small></td>
        <td>{entry.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
        <td><span className={`status-badge status-${entry.status}`}>{labels[entry.status]}</span></td>
        <td>{formatCents(entry.grossAmountCents)}</td><td>{formatCents(paidCents)}</td><td><strong>{formatCents(balanceCents)}</strong></td>
        <td><FinancialSettlementForm financialEntryId={entry.id} balanceCents={balanceCents} accounts={accounts} settlements={entrySettlements} /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
