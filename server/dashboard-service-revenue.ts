import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { serviceCatalogItems, serviceRecords, workOrderItems } from "../db/schema";
import {
  summarizeServiceRevenue,
  type ServiceRevenueItem,
} from "../domain/dashboard-service-revenue";

export async function listDashboardServiceRevenue(
  workshopId: string,
  period: { from: Date; to: Date },
) {
  const database = getDatabase();
  const completedOrderFilter = and(
    eq(serviceRecords.workshopId, workshopId),
    inArray(serviceRecords.status, ["completed", "delivered"]),
    isNotNull(serviceRecords.completedAt),
    gte(serviceRecords.completedAt, period.from),
    lt(serviceRecords.completedAt, period.to),
  );
  const [orders, items] = await Promise.all([
    database
      .select({
        orderId: serviceRecords.id,
        catalogName: serviceCatalogItems.name,
        description: serviceRecords.description,
        amountCents: serviceRecords.amountCents,
      })
      .from(serviceRecords)
      .leftJoin(
        serviceCatalogItems,
        and(
          eq(serviceCatalogItems.id, serviceRecords.serviceCatalogId),
          eq(serviceCatalogItems.workshopId, workshopId),
        ),
      )
      .where(completedOrderFilter),
    database
      .select({
        orderId: workOrderItems.serviceRecordId,
        type: workOrderItems.type,
        catalogName: serviceCatalogItems.name,
        description: workOrderItems.description,
        quantity: workOrderItems.quantity,
        unitPriceCents: workOrderItems.unitPriceCents,
        discountCents: workOrderItems.discountCents,
      })
      .from(workOrderItems)
      .innerJoin(
        serviceRecords,
        and(
          eq(serviceRecords.id, workOrderItems.serviceRecordId),
          eq(workOrderItems.workshopId, workshopId),
        ),
      )
      .leftJoin(
        serviceCatalogItems,
        and(
          eq(serviceCatalogItems.id, workOrderItems.serviceCatalogId),
          eq(serviceCatalogItems.workshopId, workshopId),
        ),
      )
      .where(completedOrderFilter),
  ]);

  return summarizeServiceRevenue(orders, items as ServiceRevenueItem[]);
}
