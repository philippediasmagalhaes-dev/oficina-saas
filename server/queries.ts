import { buildFinancialSnapshot } from "../domain/finance";
import { summarizeFinancialCategories } from "../domain/financial-category-report";
import { deriveDashboardPriorities } from "../domain/dashboard-priorities";
import {
  describeFinancialPeriod,
  filterFinancialServices,
  type FinancialFilters,
} from "../domain/service-filters";
import { getOwnerContext } from "./owner-context";
import { getVehicle, listVehicles, listVehiclesPage } from "./vehicles";
import { listCollaboratorPayables, listCollaboratorRates, listCollaborators, listWorkOrderAssignments } from "./collaborators";
import { listInventoryMovements } from "./inventory";
import { countWorkOrdersByStatus, getWorkOrder, listWorkOrdersPage } from "./work-orders";
import { ensureDefaultFinancialAccount, ensureMonthlyCollaboratorPayables, ensureMonthlyFinancialOccurrences, getFinancialOverviewTotals, getFinancialSettings, getOutstandingFinancialTotal, listCashSessions, listFinancialAccounts, listFinancialEntriesPage, listFinancialReportEntries, listFinancialSettlements, listSuppliers, listWorkOrderPayments } from "./finance";
import type { RawFinancialFilters } from "../domain/financial-filters";
import { getWhatsAppAutomationStatus } from "./whatsapp";
import { listFinancialCategories } from "./financial-categories";
import { listMaintenanceReturns } from "./retention";
import { seedAutomotiveCatalog } from "./automotive-catalog";

export async function getDashboardData() {
  const context = await getOwnerContext();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [services, inventory, orders, orderCounts, ledger, overdueReceivables, returns] = await Promise.all([
    context.repository.listServices(context.workshopId),
    context.repository.listInventory(context.workshopId),
    listWorkOrdersPage(context.workshopId, { query: "", page: 1, pageSize: 8 }),
    countWorkOrdersByStatus(context.workshopId),
    listFinancialReportEntries(context.workshopId, { from: monthStart, to: nextMonth, recognitionMode: "accrual" }),
    listFinancialEntriesPage(context.workshopId, { direction: "income", due: "overdue", pageSize: 12 }),
    listMaintenanceReturns(context.workshopId, "1", now),
  ]);
  const currentMonthServices = filterFinancialServices(services, {
    period: "current_month",
    query: "",
    from: "",
    to: "",
  });
  const lowStockItems = inventory.filter((item) => item.active && item.currentQuantity - (item.reservedQuantity ?? 0) <= item.minimumQuantity);
  const priorities = deriveDashboardPriorities({
    overdueReceivables: overdueReceivables.items,
    readyOrders: orderCounts.ready,
    lowStockItems: lowStockItems.length,
    dueReturns: returns.total,
  });
  return {
    ...context,
    services: currentMonthServices,
    recentOrders: orders.items,
    orderCounts,
    lowStockItems: lowStockItems.slice(0, 5),
    returns: returns.items.slice(0, 5),
    priorities,
    metrics: {
      revenueCents: currentMonthServices.reduce(
        (total, service) => total + service.amountCents,
        0,
      ),
      serviceCount: currentMonthServices.length,
      opportunities: returns.total,
      lowStock: lowStockItems.length,
      openOrders: orderCounts.active,
      readyOrders: orderCounts.ready,
      receiptsCents: ledger.filter((entry) => entry.direction === "income" && entry.status === "settled").reduce((sum, entry) => sum + entry.netAmountCents, 0),
      overdueReceivablesCents: await getOutstandingFinancialTotal(context.workshopId, "income", now),
    },
  };
}

export async function getCustomers(input: { query: string; page: number; pageSize: number }) {
  const context = await getOwnerContext();
  return {
    ...context,
    customers: await context.repository.listCustomersPage(context.workshopId, input),
  };
}

export async function getCustomer(customerId: string) {
  const context = await getOwnerContext();
  return {
    ...context,
    customer: await context.repository.findCustomer(
      context.workshopId,
      customerId,
    ),
  };
}

export async function getServiceRecords() {
  const context = await getOwnerContext();
  await seedAutomotiveCatalog(context.workshopId);
  const [services, catalog] = await Promise.all(
    [
      context.repository.listServices(context.workshopId, 24),
      context.repository.listServiceCatalog(context.workshopId),
    ],
  );
  return { ...context, services, catalog };
}

export async function getServiceOrder(serviceId: string) {
  const context = await getOwnerContext();
  return {
    ...context,
    order: await context.repository.getServiceOrder(
      context.workshopId,
      serviceId,
    ),
  };
}

export async function getRetentionOpportunities(page?: string) {
  const context = await getOwnerContext();
  const [returns, automation] = await Promise.all([
    listMaintenanceReturns(context.workshopId, page),
    getWhatsAppAutomationStatus(context.workshopId),
  ]);
  return { ...context, returns, automation };
}

export async function getInventory() {
  const context = await getOwnerContext();
  const [inventory, movements] = await Promise.all([context.repository.listInventory(context.workshopId), listInventoryMovements(context.workshopId)]);
  return { ...context, inventory, movements };
}

export async function getFinancialDashboard(filters: FinancialFilters & { status?: string; category?: string; recognitionMode?: "cash" | "accrual"; paymentMethod?: string; collaboratorId?: string }) {
  const context = await getOwnerContext();
  await ensureMonthlyCollaboratorPayables(context.workshopId);
  await ensureMonthlyFinancialOccurrences(context.workshopId);
  const [allServices, allEntries, financialSettings, collaborators, categories] = await Promise.all([
    context.repository.listServices(context.workshopId),
    listFinancialReportEntries(context.workshopId, { status: filters.status, category: filters.category, recognitionMode: filters.recognitionMode, paymentMethod: filters.paymentMethod, collaboratorId: filters.collaboratorId }),
    getFinancialSettings(context.workshopId),
    listCollaborators(context.workshopId),
    listFinancialCategories(context.workshopId),
  ]);
  const services = filterFinancialServices(allServices, filters);
  const reportEntries = allEntries.flatMap((entry) => {
    const completedAt = filters.recognitionMode === "cash" ? entry.settledAt : entry.competenceDate;
    return completedAt ? [{ ...entry, completedAt, customerName: entry.collaboratorName ?? "", vehicleLabel: entry.paymentMethod }] : [];
  });
  const entries = filterFinancialServices(reportEntries, filters);
  const incomeCents = entries.filter((entry) => entry.direction === "income").reduce((sum, entry) => sum + entry.netAmountCents, 0);
  const expenseCents = entries.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + entry.netAmountCents, 0);
  const reserveCents = entries.filter((entry) => entry.direction === "reserve").reduce((sum, entry) => sum + entry.netAmountCents, 0);
  const categoryReport = summarizeFinancialCategories(entries, categories);
  return {
    ...context,
    services,
    snapshot: buildFinancialSnapshot(services),
    periodLabel: describeFinancialPeriod(filters),
    customerCount: new Set(services.map((service) => service.customerId)).size,
    entries,
    financialSettings: financialSettings.settings,
    collaborators,
    categories,
    categoryReport,
    ledger: { incomeCents, expenseCents, reserveCents, balanceCents: incomeCents - expenseCents - reserveCents },
  };
}

export async function getFinancialWorkspace(filters: RawFinancialFilters = {}) {
  const context = await getOwnerContext();
  await ensureDefaultFinancialAccount(context.workshopId);
  await ensureMonthlyCollaboratorPayables(context.workshopId);
  await ensureMonthlyFinancialOccurrences(context.workshopId);
  const [entries, accounts, suppliers, categories, cashSessions, overview] = await Promise.all([
    listFinancialEntriesPage(context.workshopId, filters),
    listFinancialAccounts(context.workshopId),
    listSuppliers(context.workshopId),
    listFinancialCategories(context.workshopId),
    listCashSessions(context.workshopId),
    getFinancialOverviewTotals(context.workshopId),
  ]);
  const settlements = await listFinancialSettlements(context.workshopId, entries.items.map((entry) => entry.id));
  return { ...context, entries, accounts, suppliers, categories, cashSessions, settlements, overview };
}

export async function getWorkOrdersData(input: { query: string; page: number; pageSize: number; includeFormOptions?: boolean; selectedVehicleId?: string }) {
  const context = await getOwnerContext();
  const [orders, statusCounts, customers, vehicles] = await Promise.all([
    listWorkOrdersPage(context.workshopId, input),
    countWorkOrdersByStatus(context.workshopId),
    input.includeFormOptions ? context.repository.listCustomersPage(context.workshopId, { query: "", page: 1, pageSize: 20 }).then((result) => result.items) : Promise.resolve([]),
    Promise.resolve([]),
  ]);
  const selectedVehicle = input.selectedVehicleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.selectedVehicleId) ? await context.repository.findVehicle(context.workshopId, input.selectedVehicleId) : null;
  if (selectedVehicle && !customers.some((customer) => customer.id === selectedVehicle.customerId)) {
    const customer = await context.repository.findCustomer(context.workshopId, selectedVehicle.customerId);
    if (customer) customers.push(customer);
  }
  return { ...context, orders, statusCounts, customers, vehicles, selectedVehicle };
}

export async function getWorkOrderData(serviceRecordId: string) {
  const context = await getOwnerContext();
  const [order, catalog, inventory, collaborators, assignments, financialSettings] = await Promise.all([
    getWorkOrder(context.workshopId, serviceRecordId),
    context.repository.listServiceCatalog(context.workshopId),
    context.repository.listInventory(context.workshopId),
    listCollaborators(context.workshopId),
    listWorkOrderAssignments(context.workshopId, serviceRecordId),
    getFinancialSettings(context.workshopId),
  ]);
  const [customer, vehicle, payments] = order ? await Promise.all([
    context.repository.findCustomer(context.workshopId, order.customerId),
    order.vehicleId ? context.repository.findVehicle(context.workshopId, order.vehicleId) : Promise.resolve(null),
    listWorkOrderPayments(context.workshopId, serviceRecordId),
  ]) : [null, null, []];
  return { ...context, order, catalog, inventory, collaborators, assignments, financialSettings, customer, vehicle, payments };
}

export async function getCollaboratorsData(period: { from: Date; to: Date }) {
  const context = await getOwnerContext();
  await ensureMonthlyCollaboratorPayables(context.workshopId);
  const [collaborators, rates, catalog, payables] = await Promise.all([
    listCollaborators(context.workshopId),
    listCollaboratorRates(context.workshopId),
    context.repository.listServiceCatalog(context.workshopId),
    listCollaboratorPayables(context.workshopId, period),
  ]);
  return { ...context, collaborators, rates, catalog, payables };
}

export async function getVehiclesData(input: { query: string; page: number; pageSize: number; includeFormOptions?: boolean }) {
  const context = await getOwnerContext();
  const [vehicles, customers] = await Promise.all([
    listVehiclesPage(context.workshopId, input),
    input.includeFormOptions ? context.repository.listCustomersPage(context.workshopId, { query: "", page: 1, pageSize: 20 }).then((result) => result.items) : Promise.resolve([]),
  ]);
  return { ...context, vehicles, customers };
}

export async function getVehicleData(vehicleId: string) {
  const context = await getOwnerContext();
  const [vehicle, customers] = await Promise.all([
    getVehicle(context.workshopId, vehicleId),
    context.repository.listCustomersPage(context.workshopId, { query: "", page: 1, pageSize: 20 }).then((result) => result.items),
  ]);
  if (vehicle && !customers.some((customer) => customer.id === vehicle.customerId)) {
    const customer = await context.repository.findCustomer(context.workshopId, vehicle.customerId);
    if (customer) customers.push(customer);
  }
  return { ...context, vehicle, customers };
}
