export function formatOptionalDate(date: Date | null | undefined): string {
  return date
    ? date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Data não informada";
}

export function parseMonthPeriod(value: string | undefined, now = new Date()) {
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const selected = /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") ? value! : fallback;
  const [year, month] = selected.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const label = from.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { value: selected, label, from, to };
}
