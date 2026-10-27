export function distributeMissingCompletionDates(
  orderIds: string[],
  anchor: Date,
  monthCount = 12,
) {
  if (!Number.isInteger(monthCount) || monthCount < 1) throw new Error("O período deve ter ao menos um mês.");
  const sortedIds = [...orderIds].sort((left, right) => left.localeCompare(right));
  const result = new Map<string, Date>();
  sortedIds.forEach((id, index) => {
    const monthsAgo = (index % monthCount) + 1;
    const cycle = Math.floor(index / monthCount);
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth() - monthsAgo;
    const day = 5 + (cycle % 21);
    result.set(id, new Date(Date.UTC(year, month, day, 15, 0, 0)));
  });
  return result;
}
