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

export function allocateCentsProportionally(totalCents: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0)) throw new Error("Valores inválidos para rateio.");
  if (!weights.length) return [];
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight === 0) {
    if (totalCents === 0) return weights.map(() => 0);
    throw new Error("Não é possível ratear sem base.");
  }
  if (totalCents > totalWeight) throw new Error("Rateio maior que a base.");
  const denominator = BigInt(totalWeight);
  const shares = weights.map((weight, index) => {
    const numerator = BigInt(totalCents) * BigInt(weight);
    return { index, cents: Number(numerator / denominator), remainder: numerator % denominator };
  });
  let remaining = totalCents - shares.reduce((sum, share) => sum + share.cents, 0);
  for (const share of [...shares].sort((left, right) => left.remainder === right.remainder ? left.index - right.index : left.remainder > right.remainder ? -1 : 1)) {
    if (remaining <= 0) break;
    share.cents += 1;
    remaining -= 1;
  }
  return shares.sort((left, right) => left.index - right.index).map((share) => share.cents);
}
