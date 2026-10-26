export type OperationalFinancialStatus =
  | "expected"
  | "partial"
  | "settled"
  | "cancelled";

export type SettlementAmount = {
  amountCents: number;
  reversedAt: Date | null;
};

function positiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

export function calculateEntryBalance(
  grossAmountCents: number,
  settlements: SettlementAmount[],
) {
  if (!positiveInteger(grossAmountCents))
    throw new Error("O valor do lançamento deve ser positivo.");
  const settledCents = settlements.reduce((total, settlement) => {
    if (!positiveInteger(settlement.amountCents))
      throw new Error("O valor da baixa deve ser positivo.");
    return settlement.reversedAt ? total : total + settlement.amountCents;
  }, 0);
  const balanceCents = grossAmountCents - settledCents;
  if (balanceCents < 0)
    throw new Error("A baixa não pode superar o saldo do lançamento.");
  return { settledCents, balanceCents };
}

export function deriveEntryStatus(
  grossAmountCents: number,
  balanceCents: number,
  cancelled: boolean,
): OperationalFinancialStatus {
  if (cancelled) return "cancelled";
  if (balanceCents === grossAmountCents) return "expected";
  if (balanceCents === 0) return "settled";
  if (balanceCents > 0 && balanceCents < grossAmountCents) return "partial";
  throw new Error("Saldo financeiro inválido.");
}

function anchoredMonth(date: Date, offset: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + offset;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function splitInstallments(
  totalCents: number,
  installmentCount: number,
  firstDueDate: Date,
) {
  if (!positiveInteger(totalCents))
    throw new Error("O valor parcelado deve ser positivo.");
  if (!positiveInteger(installmentCount))
    throw new Error("A quantidade de parcelas deve ser positiva.");
  const baseAmount = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => ({
    installmentNumber: index + 1,
    installmentCount,
    amountCents: baseAmount + (index < remainder ? 1 : 0),
    dueDate: anchoredMonth(firstDueDate, index),
  }));
}
