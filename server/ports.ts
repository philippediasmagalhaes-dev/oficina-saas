export type WorkshopSummary = { id: string; ownerUserId: string; name: string; inactivityDays: number };
export type CustomerSummary = {
  id: string;
  workshopId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  whatsappConsent?: boolean;
  notes?: string | null;
  lastServiceAt?: Date | null;
  nextDueAt?: Date | null;
  vehicleCount?: number;
};
export type VehicleSummary = { id: string; workshopId: string; customerId: string; plate: string; make: string; model: string; year?: number | null; odometer?: number | null };
export type ServiceSummary = { id: string; workshopId: string; customerId: string; customerName?: string; vehicleLabel?: string | null; description: string; amountCents: number; completedAt: Date; nextDueAt?: Date | null };
export type InventorySummary = { id: string; workshopId: string; sku?: string | null; name: string; unit: string; costCents: number; salePriceCents: number; currentQuantity: number; minimumQuantity: number; active: boolean };
export type ContactEventSummary = { id: string; workshopId: string; customerId: string; reason: string; message: string; contactedAt: Date };

export type InventoryConsumption = { inventoryItemId: string; quantity: number };
export type PersistedServiceInput = {
  workshopId: string;
  customerId: string;
  vehicleId: string | null;
  description: string;
  amountCents: number;
  completedAt: Date;
  odometer: number | null;
  notes: string | null;
  returnIntervalDays: number | null;
  nextDueAt: Date | null;
};
export type ServiceWithInventoryInput = PersistedServiceInput & { inventory: InventoryConsumption[] };

export interface CrmRepository {
  getWorkshopForUser(userId: string): Promise<WorkshopSummary | null>;
  createWorkshop(input: { ownerUserId: string; name: string; inactivityDays: number }): Promise<WorkshopSummary>;
  findCustomer(workshopId: string, customerId: string): Promise<CustomerSummary | null>;
  findVehicle(workshopId: string, vehicleId: string): Promise<VehicleSummary | null>;
  listCustomers(workshopId: string): Promise<CustomerSummary[]>;
  listVehicles(workshopId: string): Promise<VehicleSummary[]>;
  listServices(workshopId: string): Promise<ServiceSummary[]>;
  listInventory(workshopId: string): Promise<InventorySummary[]>;
  listContactEvents(workshopId: string): Promise<ContactEventSummary[]>;
  createCustomer(input: Omit<CustomerSummary, "id" | "lastServiceAt" | "nextDueAt" | "vehicleCount">): Promise<CustomerSummary>;
  createVehicle(input: Omit<VehicleSummary, "id">): Promise<VehicleSummary>;
  recordService(input: PersistedServiceInput): Promise<ServiceSummary>;
  consumeInventoryAtomically(input: ServiceWithInventoryInput): Promise<ServiceSummary>;
  createInventoryItem(input: Omit<InventorySummary, "id" | "active">): Promise<InventorySummary>;
  adjustInventory(input: { workshopId: string; inventoryItemId: string; delta: number; note: string | null }): Promise<InventorySummary>;
  recordContact(input: { workshopId: string; customerId: string; reason: string; message: string }): Promise<ContactEventSummary>;
}
