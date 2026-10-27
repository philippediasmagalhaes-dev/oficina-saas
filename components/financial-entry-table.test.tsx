import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinancialEntryTable } from "./financial-entry-table";

const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  description: "Fornecedor de peças",
  direction: "expense" as const,
  category: "parts",
  grossAmountCents: 10_000,
  dueDate: new Date("2026-10-28T00:00:00Z"),
  status: "partial" as const,
  installmentNumber: 1,
  installmentCount: 2,
  documentNumber: "NF 42",
};

describe("financial entry table", () => {
  it("shows status, paid amount, open balance and installment", () => {
    const html = renderToStaticMarkup(<FinancialEntryTable entries={[entry]} settlements={[{
      id: "00000000-0000-4000-8000-000000000002",
      financialEntryId: entry.id,
      amountCents: 4_000,
      reversedAt: null,
      settledAt: new Date("2026-10-26T00:00:00Z"),
    }]} accounts={[]} />);
    expect(html).toContain("Parcial");
    expect(html.replaceAll("&nbsp;", " ").replaceAll("\u00a0", " ")).toContain("R$ 40,00");
    expect(html.replaceAll("&nbsp;", " ").replaceAll("\u00a0", " ")).toContain("R$ 60,00");
    expect(html).toContain("1/2");
  });

  it("offers settlement for open titles and reversal for active settlements", () => {
    const html = renderToStaticMarkup(<FinancialEntryTable entries={[entry]} settlements={[{
      id: "00000000-0000-4000-8000-000000000002",
      financialEntryId: entry.id,
      amountCents: 4_000,
      reversedAt: null,
      settledAt: new Date("2026-10-26T00:00:00Z"),
    }]} accounts={[]} />);
    expect(html).toContain("Registrar baixa");
    expect(html).toContain("Estornar");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="settlement-00000000-0000-4000-8000-000000000001"');
  });

  it("shows a legacy settled title as fully paid without offering another settlement", () => {
    const html = renderToStaticMarkup(<FinancialEntryTable entries={[{ ...entry, status: "settled" }]} settlements={[]} accounts={[]} />);
    const normalized = html.replaceAll("&nbsp;", " ").replaceAll("\u00a0", " ");
    expect(normalized).toContain("R$ 100,00");
    expect(normalized).toContain("R$ 0,00");
    expect(html).not.toContain("Registrar baixa");
  });
});
