import { describe, expect, it, vi } from "vitest";

const { claimBusinessFinEntries } = vi.hoisted(() => ({
  claimBusinessFinEntries: vi.fn(async () => [{ id: "entry", externalId: "manual:1", direction: "expense", category: "operational", description: "Aluguel", grossAmountCents: 10000, feeAmountCents: 0, netAmountCents: 10000, competenceDate: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-05T00:00:00Z"), settledAt: null, status: "expected" }]),
}));
vi.mock("../../../../server/owner-context", () => ({ getOwnerContext: vi.fn(async () => ({ workshopId: "workshop" })) }));
vi.mock("../../../../server/finance", () => ({ claimBusinessFinEntries, listFinancialEntries: vi.fn(async () => []) }));

import { GET } from "./route";

describe("Business Fin export route", () => {
  it("returns an authenticated CSV download and records its row", async () => {
    const response = await GET(new Request("https://example.test/api/financeiro/business-fin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("x-exported-rows")).toBe("1");
    expect(await response.text()).toContain("manual:1");
    expect(claimBusinessFinEntries).toHaveBeenCalledWith("workshop", expect.objectContaining({ from: expect.any(Date), to: expect.any(Date), recognitionMode: "accrual" }));
  });
});
