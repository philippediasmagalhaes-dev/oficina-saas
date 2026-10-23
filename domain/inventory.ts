export function applyStockDelta(current: number, delta: number): number {
  if (!Number.isInteger(current) || !Number.isInteger(delta)) throw new Error("Quantidade inválida");
  const next = current + delta;
  if (next < 0) throw new Error("Estoque insuficiente");
  return next;
}

type StockPosition = { current: number; reserved: number };

function validatePosition(position: StockPosition, quantity: number) {
  if (![position.current, position.reserved, quantity].every(Number.isInteger) || position.current < 0 || position.reserved < 0 || quantity < 0)
    throw new Error("Quantidade inválida");
}

export function applyReservation(position: StockPosition, reservationDelta: number) {
  if (![position.current, position.reserved, reservationDelta].every(Number.isInteger) || position.current < 0 || position.reserved < 0)
    throw new Error("Quantidade inválida");
  const reserved = position.reserved + reservationDelta;
  if (reserved < 0) throw new Error("Reserva insuficiente");
  if (reserved > position.current) throw new Error("Estoque disponível insuficiente");
  return { current: position.current, reserved, available: position.current - reserved };
}

export function applyReservedConsumption(position: StockPosition, quantity: number) {
  validatePosition(position, quantity);
  if (position.reserved < quantity) throw new Error("Reserva insuficiente");
  if (position.current < quantity) throw new Error("Estoque insuficiente");
  const current = position.current - quantity;
  const reserved = position.reserved - quantity;
  return { current, reserved, available: current - reserved };
}
