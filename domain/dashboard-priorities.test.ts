import { describe, expect, it } from "vitest";
import { deriveDashboardPriorities } from "./dashboard-priorities";

describe("dashboard priorities", () => {
  it("orders overdue receivables before operational alerts", () => {
    const priorities = deriveDashboardPriorities({
      overdueReceivables: [
        { status: "expected", grossAmountCents: 12_000 },
        { status: "partial", grossAmountCents: 8_000 },
        { status: "settled", grossAmountCents: 99_000 },
      ],
      readyOrders: 2,
      lowStockItems: 3,
      dueReturns: 4,
    });
    expect(priorities.map((item) => item.kind)).toEqual(["overdue", "ready", "stock", "returns"]);
    expect(priorities[0]).toMatchObject({ count: 2, amountCents: 20_000, href: "/financeiro/contas-a-receber?due=overdue" });
  });

  it("omits empty alerts", () => {
    expect(deriveDashboardPriorities({ overdueReceivables: [], readyOrders: 0, lowStockItems: 0, dueReturns: 2 })).toEqual([
      expect.objectContaining({ kind: "returns", count: 2 }),
    ]);
  });
});
