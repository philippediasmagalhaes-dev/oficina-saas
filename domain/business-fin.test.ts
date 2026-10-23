import { describe, expect, it } from "vitest";
import { selectBusinessFinEntries, toBusinessFinCsv } from "./business-fin";

const entries = [{ externalId: "os:1:payment:1", direction: "income" as const, category: "service_income", description: "Revisão; óleo", grossAmountCents: 12_345, feeAmountCents: 345, netAmountCents: 12_000, competenceDate: new Date("2026-10-23T12:00:00Z"), dueDate: new Date("2026-10-25T12:00:00Z"), settledAt: new Date("2026-10-23T12:00:00Z"), status: "settled" as const }];

describe("Business Fin CSV", () => {
  it("exports UTF-8 BOM, Brazilian dates and decimals with escaped text", () => {
    const csv = toBusinessFinCsv(entries);
    expect(csv.startsWith("\uFEFFID externo;Tipo")).toBe(true);
    expect(csv).toContain('"Revisão; óleo"');
    expect(csv).toContain("123,45;3,45;120,00;23/10/2026;25/10/2026");
    expect(csv).toContain("os:1:payment:1");
  });

  it("excludes previously exported rows unless explicitly requested", () => {
    expect(selectBusinessFinEntries(entries, new Set(["os:1:payment:1"]), false)).toEqual([]);
    expect(selectBusinessFinEntries(entries, new Set(["os:1:payment:1"]), true)).toHaveLength(1);
  });
});
