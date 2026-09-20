export function parseCurrencyToCents(value: string): number {
  const normalized = value.trim().replace(/^R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Valor inválido");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Valor inválido");
  return cents;
}

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Valor inválido");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
