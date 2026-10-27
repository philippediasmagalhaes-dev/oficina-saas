import { and, desc, eq, gte } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { customers, serviceRecords, workOrderApprovals } from "../db/schema";

export async function listApprovalNotifications(workshopId: string) {
  return getDatabase().select({ id: workOrderApprovals.id, serviceRecordId: serviceRecords.id, orderNumber: serviceRecords.orderNumber, customerName: customers.name, decidedAt: workOrderApprovals.decidedAt }).from(workOrderApprovals)
    .innerJoin(serviceRecords, and(eq(serviceRecords.id, workOrderApprovals.serviceRecordId), eq(serviceRecords.workshopId, workshopId)))
    .innerJoin(customers, and(eq(customers.id, serviceRecords.customerId), eq(customers.workshopId, workshopId)))
    .where(and(eq(workOrderApprovals.workshopId, workshopId), eq(workOrderApprovals.decision, "approved"), gte(workOrderApprovals.decidedAt, new Date(Date.now() - 7 * 86400000))))
    .orderBy(desc(workOrderApprovals.decidedAt)).limit(20);
}
