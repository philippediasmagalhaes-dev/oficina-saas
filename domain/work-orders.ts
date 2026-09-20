export const workOrderStatuses = [
  "open",
  "diagnosis",
  "awaiting_approval",
  "approved",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
  "completed",
] as const;

export type WorkOrderStatus = (typeof workOrderStatuses)[number];

export const workOrderStatusLabels: Record<WorkOrderStatus, string> = {
  open: "Aberta",
  diagnosis: "Em diagnóstico",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em execução",
  ready: "Pronta",
  delivered: "Entregue",
  cancelled: "Cancelada",
  completed: "Concluída",
};

const transitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ["diagnosis", "cancelled"],
  diagnosis: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["diagnosis", "approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["in_progress", "delivered"],
  delivered: [],
  cancelled: [],
  completed: [],
};

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus) {
  return transitions[from].includes(to);
}

export function calculateQuoteTotal(
  items: { quantity: number; unitPriceCents: number }[],
  discountCents: number,
) {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0)
    throw new Error("Desconto inválido");
  const subtotalCents = items.reduce((total, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      throw new Error("Quantidade inválida");
    if (!Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0)
      throw new Error("Valor inválido");
    return total + item.quantity * item.unitPriceCents;
  }, 0);
  return {
    subtotalCents,
    discountCents: Math.min(discountCents, subtotalCents),
    totalCents: Math.max(subtotalCents - discountCents, 0),
  };
}
