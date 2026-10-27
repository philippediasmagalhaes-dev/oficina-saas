type ReportDirection = "income" | "expense" | "reserve";

type ReportEntry = {
  direction: ReportDirection;
  category: string;
  netAmountCents: number;
  status: string;
};

type CategoryDefinition = {
  key: string;
  name: string;
  direction: string;
};

export type FinancialCategorySummary = {
  key: string;
  name: string;
  amountCents: number;
  percentage: number;
};

export function excludeCancelledFinancialEntries<T extends { status: string }>(entries: T[]) {
  return entries.filter((entry) => entry.status !== "cancelled");
}

function readableCategory(key: string) {
  const value = key.replaceAll("_", " ").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Sem categoria";
}

export function summarizeFinancialCategories(entries: ReportEntry[], categories: CategoryDefinition[]) {
  const names = new Map(categories.map((category) => [category.key, category.name]));
  const activeEntries = excludeCancelledFinancialEntries(entries);
  const summarize = (direction: "income" | "expense") => {
    const amounts = new Map<string, number>();
    for (const entry of activeEntries) {
      if (entry.direction !== direction) continue;
      amounts.set(entry.category, (amounts.get(entry.category) ?? 0) + entry.netAmountCents);
    }
    const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
    return [...amounts.entries()]
      .map(([key, amountCents]) => ({
        key,
        name: names.get(key) ?? readableCategory(key),
        amountCents,
        percentage: total ? Number(((amountCents / total) * 100).toFixed(2)) : 0,
      }))
      .sort((left, right) => right.amountCents - left.amountCents || left.name.localeCompare(right.name, "pt-BR"));
  };
  return { income: summarize("income"), expense: summarize("expense") };
}
