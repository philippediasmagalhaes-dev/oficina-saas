import { classifyCustomer } from "../domain/forecast";
import { buildFinancialSnapshot } from "../domain/finance";
import { getOwnerContext } from "./owner-context";

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
  return {
    ...context,
    customers,
    services,
    inventory,
    retention,
    metrics: {
      revenueCents: services.reduce(
        (total, service) => total + service.amountCents,
        0,
      ),
      serviceCount: services.length,
      customerCount: customers.length,
      opportunities: retention.filter(
        (customer) => customer.classification !== "current",
      ).length,
      lowStock: inventory.filter(
        (item) => item.active && item.currentQuantity <= item.minimumQuantity,
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
  return {
    ...context,
    inventory: await context.repository.listInventory(context.workshopId),
  };
}

export async function getFinancialDashboard() {
  const context = await getOwnerContext();
  const services = await context.repository.listServices(context.workshopId);
  return { ...context, services, snapshot: buildFinancialSnapshot(services) };
}
