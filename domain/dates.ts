export function formatOptionalDate(date: Date | null | undefined): string {
  return date
    ? date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Data não informada";
}

export function parseMonthPeriod(value: string | undefined, now = new Date()) {
  const fallbackParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const fallbackYear = fallbackParts.find((part) => part.type === "year")?.value;
  const fallbackMonth = fallbackParts.find((part) => part.type === "month")?.value;
  const fallback = `${fallbackYear}-${fallbackMonth}`;
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
