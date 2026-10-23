import { classifyCustomer } from "../domain/forecast";
import { buildFinancialSnapshot } from "../domain/finance";
import {
  describeFinancialPeriod,
  filterFinancialServices,
  type FinancialFilters,
} from "../domain/service-filters";
import { getOwnerContext } from "./owner-context";
import { getVehicle, listVehicles } from "./vehicles";
import { listCollaboratorRates, listCollaborators, listWorkOrderAssignments } from "./collaborators";
import { listInventoryMovements } from "./inventory";
import { getWorkOrder, listWorkOrders } from "./work-orders";
import { ensureMonthlyCollaboratorPayables, getFinancialSettings, listFinancialReportEntries } from "./finance";

export async function getDashboardData() {
  const context = await getOwnerContext();
  const [customers, services, inventory] = await Promise.all([
    context.repository.listCustomers(context.workshopId),
    context.repository.listServices(context.workshopId),
    context.repository.listInventory(context.workshopId),
  ]);
  const retention = customers.map((customer) => ({
    ...customer,
    classification: classifyCustomer({
      nextDueAt: customer.nextDueAt ?? null,
      lastServiceAt: customer.lastServiceAt ?? null,
      inactivityDays: context.workshop.inactivityDays,
    }),
  }));
  const currentMonthServices = filterFinancialServices(services, {
    period: "current_month",
    query: "",
    from: "",
    to: "",
  });
  return {
    ...context,
    customers,
    services: currentMonthServices,
    inventory,
    retention,
    metrics: {
      revenueCents: currentMonthServices.reduce(
        (total, service) => total + service.amountCents,
        0,
      ),
      serviceCount: currentMonthServices.length,
      customerCount: customers.length,
      opportunities: retention.filter(
        (customer) => customer.classification !== "current",
      ).length,
      lowStock: inventory.filter(
        (item) => item.active && item.currentQuantity - (item.reservedQuantity ?? 0) <= item.minimumQuantity,
      ).length,
    },
  };
}

export async function getCustomers() {
  const context = await getOwnerContext();
  return {
    ...context,
    customers: await context.repository.listCustomers(context.workshopId),
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
  const [services, customers, vehicles, catalog, inventory] = await Promise.all(
    [
      context.repository.listServices(context.workshopId),
      context.repository.listCustomers(context.workshopId),
      context.repository.listVehicles(context.workshopId),
      context.repository.listServiceCatalog(context.workshopId),
      context.repository.listInventory(context.workshopId),
    ],
  );
  return { ...context, services, customers, vehicles, catalog, inventory };
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

export async function getRetentionOpportunities() {
  const context = await getOwnerContext();
  const customers = await context.repository.listCustomers(context.workshopId);
  const opportunities = customers
    .map((customer) => ({
      ...customer,
      classification: classifyCustomer({
        nextDueAt: customer.nextDueAt ?? null,
        lastServiceAt: customer.lastServiceAt ?? null,
        inactivityDays: context.workshop.inactivityDays,
      }),
    }))
    .filter((customer) => customer.classification !== "current");
  return { ...context, opportunities };
}

export async function getInventory() {
  const context = await getOwnerContext();
  const [inventory, movements] = await Promise.all([context.repository.listInventory(context.workshopId), listInventoryMovements(context.workshopId)]);
  return { ...context, inventory, movements };
}

export async function getFinancialDashboard(filters: FinancialFilters & { status?: string; category?: string; recognitionMode?: "cash" | "accrual"; paymentMethod?: string; collaboratorId?: string }) {
  const context = await getOwnerContext();
  await ensureMonthlyCollaboratorPayables(context.workshopId);
  const [allServices, allEntries, financialSettings, collaborators] = await Promise.all([
    context.repository.listServices(context.workshopId),
    listFinancialReportEntries(context.workshopId, { status: filters.status, category: filters.category, recognitionMode: filters.recognitionMode, paymentMethod: filters.paymentMethod, collaboratorId: filters.collaboratorId }),
    getFinancialSettings(context.workshopId),
    listCollaborators(context.workshopId),
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
  return {
    ...context,
    services,
    snapshot: buildFinancialSnapshot(services),
    periodLabel: describeFinancialPeriod(filters),
    customerCount: new Set(services.map((service) => service.customerId)).size,
    entries,
    financialSettings: financialSettings.settings,
    collaborators,
    ledger: { incomeCents, expenseCents, reserveCents, balanceCents: incomeCents - expenseCents - reserveCents },
  };
}

export async function getWorkOrdersData() {
  const context = await getOwnerContext();
  const [orders, customers, vehicles] = await Promise.all([
    listWorkOrders(context.workshopId),
    context.repository.listCustomers(context.workshopId),
    context.repository.listVehicles(context.workshopId),
  ]);
  return { ...context, orders, customers, vehicles };
}

export async function getWorkOrderData(serviceRecordId: string) {
  const context = await getOwnerContext();
  const [order, catalog, inventory, collaborators, assignments] = await Promise.all([
    getWorkOrder(context.workshopId, serviceRecordId),
    context.repository.listServiceCatalog(context.workshopId),
    context.repository.listInventory(context.workshopId),
    listCollaborators(context.workshopId),
    listWorkOrderAssignments(context.workshopId, serviceRecordId),
  ]);
  return { ...context, order, catalog, inventory, collaborators, assignments };
}

export async function getCollaboratorsData() {
  const context = await getOwnerContext();
  const [collaborators, rates, catalog] = await Promise.all([listCollaborators(context.workshopId), listCollaboratorRates(context.workshopId), context.repository.listServiceCatalog(context.workshopId)]);
  return { ...context, collaborators, rates, catalog };
}

export async function getVehiclesData() {
  const context = await getOwnerContext();
  const [vehicles, customers] = await Promise.all([
    listVehicles(context.workshopId),
    context.repository.listCustomers(context.workshopId),
  ]);
  return { ...context, vehicles, customers };
}

export async function getVehicleData(vehicleId: string) {
  const context = await getOwnerContext();
  const [vehicle, customers] = await Promise.all([
    getVehicle(context.workshopId, vehicleId),
    context.repository.listCustomers(context.workshopId),
  ]);
  return { ...context, vehicle, customers };
}
