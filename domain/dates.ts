export function formatOptionalDate(date: Date | null | undefined): string {
  return date
    ? date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Data não informada";
}
