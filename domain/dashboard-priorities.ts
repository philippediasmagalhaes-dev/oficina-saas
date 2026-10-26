type Receivable = { status: string; grossAmountCents: number };

export type DashboardPriority = {
  kind: "overdue" | "ready" | "stock" | "returns";
  title: string;
  description: string;
  count: number;
  amountCents?: number;
  href: string;
  tone: "danger" | "warning" | "info";
};

export function deriveDashboardPriorities(input: {
  overdueReceivables: Receivable[];
  readyOrders: number;
  lowStockItems: number;
  dueReturns: number;
}): DashboardPriority[] {
  const openReceivables = input.overdueReceivables.filter((entry) => entry.status === "expected" || entry.status === "partial");
  const priorities: Array<DashboardPriority | null> = [
    openReceivables.length ? {
      kind: "overdue",
      title: "Recebimentos vencidos",
      description: "Valores que já passaram da data prevista.",
      count: openReceivables.length,
      amountCents: openReceivables.reduce((total, entry) => total + entry.grossAmountCents, 0),
      href: "/financeiro/contas-a-receber?due=overdue",
      tone: "danger",
    } : null,
    input.readyOrders ? {
      kind: "ready",
      title: "Veículos prontos para entrega",
      description: "Avise os clientes e conclua a entrega.",
      count: input.readyOrders,
      href: "/ordens?status=ready",
      tone: "warning",
    } : null,
    input.lowStockItems ? {
      kind: "stock",
      title: "Itens abaixo do estoque mínimo",
      description: "Revise a reposição antes das próximas OS.",
      count: input.lowStockItems,
      href: "/estoque?status=low",
      tone: "warning",
    } : null,
    input.dueReturns ? {
      kind: "returns",
      title: "Clientes com retorno previsto",
      description: "Oportunidades para contato e manutenção preventiva.",
      count: input.dueReturns,
      href: "/retencao",
      tone: "info",
    } : null,
  ];
  return priorities.filter((priority): priority is DashboardPriority => priority !== null);
}
