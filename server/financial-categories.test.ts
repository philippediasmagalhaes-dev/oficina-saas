import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAL_CATEGORIES,
  createFinancialCategoryService,
  type FinancialCategoryStore,
} from "./financial-categories";

describe("financial categories", () => {
  it("provides automotive defaults with stable system keys", () => {
    expect(DEFAULT_FINANCIAL_CATEGORIES).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "service_income", direction: "income", protected: true }),
      expect.objectContaining({ key: "labor_compensation", direction: "expense", protected: true }),
      expect.objectContaining({ key: "tax_reserve", direction: "reserve", protected: true }),
      expect.objectContaining({ key: "parts_purchase", direction: "expense", protected: false }),
    ]));
    expect(new Set(DEFAULT_FINANCIAL_CATEGORIES.map((item) => item.key)).size).toBe(DEFAULT_FINANCIAL_CATEGORIES.length);
  });

  it("does not deactivate a protected system category", async () => {
    const calls: string[] = [];
    const store: FinancialCategoryStore = {
      find: async () => ({ id: "system", workshopId: "w", key: "service_income", name: "Receita de serviços", direction: "income", protected: true, active: true }),
      create: async () => ({ id: "never" }),
      update: async () => ({ id: "never" }),
      deactivate: async () => { calls.push("deactivate"); return true; },
    };
    await expect(createFinancialCategoryService(store).deactivate("w", "system")).rejects.toThrow("categoria do sistema");
    expect(calls).toEqual([]);
  });

  it("allows a custom category to be edited and deactivated inside the workshop", async () => {
    const calls: string[] = [];
    const store: FinancialCategoryStore = {
      find: async () => ({ id: "custom", workshopId: "w", key: "custom:1", name: "Lavagem", direction: "expense", protected: false, active: true }),
      create: async () => ({ id: "created" }),
      update: async (input) => { calls.push(`update:${input.name}:${input.direction}`); return { id: input.categoryId }; },
      deactivate: async () => { calls.push("deactivate"); return true; },
    };
    const service = createFinancialCategoryService(store);
    await service.update({ workshopId: "w", categoryId: "custom", name: "Lavagem terceirizada", direction: "expense" });
    await service.deactivate("w", "custom");
    expect(calls).toEqual(["update:Lavagem terceirizada:expense", "deactivate"]);
  });
});

