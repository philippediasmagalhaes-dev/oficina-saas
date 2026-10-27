export type ServiceRevenueOrder = {
  orderId: string;
  catalogName: string | null;
  description: string;
  amountCents: number;
};

export type ServiceRevenueItem = {
  orderId: string;
  type: "service" | "part";
  catalogName: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
};

export type ServiceRevenueSummary = {
  name: string;
  serviceCount: number;
  revenueCents: number;
  shareBasisPoints: number;
};

function normalizedServiceName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function summarizeServiceRevenue(
  orders: ServiceRevenueOrder[],
  items: ServiceRevenueItem[],
): ServiceRevenueSummary[] {
  const ordersWithItems = new Set(items.map((item) => item.orderId));
  const entries = [
    ...items
      .filter((item) => item.type === "service")
      .map((item) => ({
        name: item.catalogName?.trim() || item.description.trim() || "Serviço sem descrição",
        serviceCount: item.quantity,
        revenueCents: Math.max(0, item.quantity * item.unitPriceCents - item.discountCents),
      })),
    ...orders
      .filter((order) => !ordersWithItems.has(order.orderId))
      .map((order) => ({
        name: order.catalogName?.trim() || order.description.trim() || "Serviço sem descrição",
        serviceCount: 1,
        revenueCents: Math.max(0, order.amountCents),
      })),
  ];

  const grouped = new Map<string, Omit<ServiceRevenueSummary, "shareBasisPoints">>();
  for (const entry of entries) {
    const key = normalizedServiceName(entry.name);
    const current = grouped.get(key);
    if (current) {
      current.serviceCount += entry.serviceCount;
      current.revenueCents += entry.revenueCents;
    } else {
      grouped.set(key, { ...entry });
    }
  }

  const totalRevenueCents = [...grouped.values()].reduce(
    (total, item) => total + item.revenueCents,
    0,
  );
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      shareBasisPoints: totalRevenueCents
        ? Math.round((item.revenueCents / totalRevenueCents) * 10000)
        : 0,
    }))
    .sort(
      (left, right) =>
        right.revenueCents - left.revenueCents ||
        right.serviceCount - left.serviceCount ||
        left.name.localeCompare(right.name, "pt-BR"),
    );
}
