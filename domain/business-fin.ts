export type BusinessFinEntry = {
  externalId: string;
  direction: "income" | "expense" | "reserve";
  category: string;
  description: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  competenceDate: Date;
  dueDate: Date;
  settledAt: Date | null;
  status: "expected" | "partial" | "settled" | "cancelled";
};

function csvCell(value: string) {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function brMoney(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function brDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date) : "";
}

const directionLabels = { income: "Receita", expense: "Despesa", reserve: "Reserva" } as const;
const statusLabels = {
  expected: "Previsto",
  partial: "Parcial",
  settled: "Realizado",
  cancelled: "Cancelado",
} as const;

export function selectBusinessFinEntries<T extends { externalId: string }>(entries: T[], exportedExternalIds: Set<string>, includeExported: boolean) {
  return includeExported ? entries : entries.filter((entry) => !exportedExternalIds.has(entry.externalId));
}

export function toBusinessFinCsv(entries: BusinessFinEntry[]) {
  const header = ["ID externo", "Tipo", "Categoria", "Descrição", "Valor bruto", "Taxa", "Valor líquido", "Competência", "Vencimento", "Baixa", "Status"];
  const rows = entries.map((entry) => [entry.externalId, directionLabels[entry.direction], entry.category, entry.description, brMoney(entry.grossAmountCents), brMoney(entry.feeAmountCents), brMoney(entry.netAmountCents), brDate(entry.competenceDate), brDate(entry.dueDate), brDate(entry.settledAt), statusLabels[entry.status]].map(csvCell).join(";"));
  return `\uFEFF${header.join(";")}\r\n${rows.join("\r\n")}\r\n`;
}
