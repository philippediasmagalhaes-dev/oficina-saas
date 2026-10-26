import { and, eq } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { financialCategories } from "../db/schema";

export type FinancialCategoryDirection = "income" | "expense" | "reserve";

export const DEFAULT_FINANCIAL_CATEGORIES = [
  { key: "service_income", name: "Receita de serviços", direction: "income", protected: true },
  { key: "labor_compensation", name: "Comissões", direction: "expense", protected: true },
  { key: "fixed_payroll", name: "Fixo mensal da equipe", direction: "expense", protected: true },
  { key: "tax_reserve", name: "Reserva de impostos", direction: "reserve", protected: true },
  { key: "parts_purchase", name: "Compra de peças", direction: "expense", protected: false },
  { key: "rent", name: "Aluguel", direction: "expense", protected: false },
  { key: "utilities", name: "Água, energia e internet", direction: "expense", protected: false },
  { key: "tools", name: "Ferramentas e equipamentos", direction: "expense", protected: false },
  { key: "workshop_maintenance", name: "Manutenção da oficina", direction: "expense", protected: false },
  { key: "marketing", name: "Divulgação", direction: "expense", protected: false },
  { key: "other_income", name: "Outras receitas", direction: "income", protected: false },
  { key: "operational", name: "Outras despesas operacionais", direction: "expense", protected: false },
  { key: "other_reserve", name: "Outras reservas", direction: "reserve", protected: false },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  direction: FinancialCategoryDirection;
  protected: boolean;
}>;

export type FinancialCategoryRecord = {
  id: string;
  workshopId: string;
  key: string;
  name: string;
  direction: FinancialCategoryDirection;
  protected: boolean;
  active: boolean;
};

export interface FinancialCategoryStore {
  find(workshopId: string, categoryId: string): Promise<FinancialCategoryRecord | null>;
  create(input: { workshopId: string; name: string; direction: FinancialCategoryDirection }): Promise<{ id: string }>;
  update(input: { workshopId: string; categoryId: string; name: string; direction: FinancialCategoryDirection }): Promise<{ id: string } | null>;
  deactivate(workshopId: string, categoryId: string): Promise<boolean>;
}

export function createFinancialCategoryService(store: FinancialCategoryStore) {
  return {
    create(input: { workshopId: string; name: string; direction: FinancialCategoryDirection }) {
      return store.create(input);
    },
    async update(input: { workshopId: string; categoryId: string; name: string; direction: FinancialCategoryDirection }) {
      const current = await store.find(input.workshopId, input.categoryId);
      if (!current) throw new Error("Categoria não encontrada.");
      const row = await store.update({
        ...input,
        direction: current.protected ? current.direction : input.direction,
      });
      if (!row) throw new Error("Categoria não encontrada.");
      return row;
    },
    async deactivate(workshopId: string, categoryId: string) {
      const current = await store.find(workshopId, categoryId);
      if (!current) throw new Error("Categoria não encontrada.");
      if (current.protected) throw new Error("Não é possível desativar uma categoria do sistema.");
      if (!(await store.deactivate(workshopId, categoryId))) throw new Error("Categoria não encontrada.");
    },
  };
}

function drizzleFinancialCategoryStore(): FinancialCategoryStore {
  const database = getDatabase();
  return {
    async find(workshopId, categoryId) {
      const [row] = await database.select().from(financialCategories).where(and(eq(financialCategories.workshopId, workshopId), eq(financialCategories.id, categoryId))).limit(1);
      return row ?? null;
    },
    async create(input) {
      const [row] = await database.insert(financialCategories).values({ ...input, key: `custom:${crypto.randomUUID()}`, protected: false }).returning({ id: financialCategories.id });
      return row;
    },
    async update(input) {
      const [row] = await database.update(financialCategories).set({ name: input.name, direction: input.direction, updatedAt: new Date() }).where(and(eq(financialCategories.workshopId, input.workshopId), eq(financialCategories.id, input.categoryId))).returning({ id: financialCategories.id });
      return row ?? null;
    },
    async deactivate(workshopId, categoryId) {
      const rows = await database.update(financialCategories).set({ active: false, updatedAt: new Date() }).where(and(eq(financialCategories.workshopId, workshopId), eq(financialCategories.id, categoryId))).returning({ id: financialCategories.id });
      return rows.length > 0;
    },
  };
}

export async function ensureDefaultFinancialCategories(workshopId: string) {
  await getDatabase().insert(financialCategories).values(DEFAULT_FINANCIAL_CATEGORIES.map((category) => ({ workshopId, ...category }))).onConflictDoNothing();
}

export async function listFinancialCategories(workshopId: string) {
  await ensureDefaultFinancialCategories(workshopId);
  return getDatabase().select().from(financialCategories).where(eq(financialCategories.workshopId, workshopId)).orderBy(financialCategories.direction, financialCategories.name);
}

export async function createFinancialCategory(input: { workshopId: string; name: string; direction: FinancialCategoryDirection }) {
  return createFinancialCategoryService(drizzleFinancialCategoryStore()).create(input);
}

export async function updateFinancialCategory(input: { workshopId: string; categoryId: string; name: string; direction: FinancialCategoryDirection }) {
  return createFinancialCategoryService(drizzleFinancialCategoryStore()).update(input);
}

export async function deactivateFinancialCategory(workshopId: string, categoryId: string) {
  return createFinancialCategoryService(drizzleFinancialCategoryStore()).deactivate(workshopId, categoryId);
}

