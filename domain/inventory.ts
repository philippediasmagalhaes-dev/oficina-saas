export function applyStockDelta(current: number, delta: number): number {
  if (!Number.isInteger(current) || !Number.isInteger(delta)) throw new Error("Quantidade inválida");
  const next = current + delta;
  if (next < 0) throw new Error("Estoque insuficiente");
  return next;
}
