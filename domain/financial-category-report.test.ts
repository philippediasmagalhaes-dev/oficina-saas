import { describe, expect, it } from "vitest";
import { summarizeFinancialCategories } from "./financial-category-report";

describe("financial category report", () => {
  it("groups net revenue and expenses and calculates participation", () => {
    const result = summarizeFinancialCategories(
      [
        { direction: "income", category: "service_income", netAmountCents: 8_000 },
        { direction: "income", category: "service_income", netAmountCents: 2_000 },
        { direction: "income", category: "other_income", netAmountCents: 5_000 },
        { direction: "expense", category: "parts", netAmountCents: 3_000 },
      ],
      [
        { key: "service_income", name: "Serviços", direction: "income" },
        { key: "parts", name: "Peças e insumos", direction: "expense" },
      ],
    );

    expect(result.income).toEqual([
      { key: "service_income", name: "Serviços", amountCents: 10_000, percentage: 66.67 },
      { key: "other_income", name: "Other income", amountCents: 5_000, percentage: 33.33 },
    ]);
    expect(result.expense).toEqual([
      { key: "parts", name: "Peças e insumos", amountCents: 3_000, percentage: 100 },
    ]);
  });

  it("keeps reserves outside income and expense category reports", () => {
    expect(summarizeFinancialCategories(
      [{ direction: "reserve", category: "tax_reserve", netAmountCents: 1_000 }],
      [],
    )).toEqual({ income: [], expense: [] });
  });
});
