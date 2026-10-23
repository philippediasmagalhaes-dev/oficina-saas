export type WorkshopSummary = {
  id: string;
  ownerUserId: string;
  name: string;
  inactivityDays: number;
  legalName?: string | null;
  document?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  printTerms?: string | null;
};
export type CustomerSummary = {
  id: string;
  workshopId: string;
  name: string;
  phone?: string | null;
  phoneNormalized?: string | null;
  email?: string | null;
  document?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  whatsappConsent?: boolean;
  whatsappConsentAt?: Date | null;
  whatsappConsentSource?: string | null;
  whatsappOptOutAt?: Date | null;
  notes?: string | null;
  lastServiceAt?: Date | null;
  nextDueAt?: Date | null;
  vehicleCount?: number;
};
export type VehicleSummary = {
  id: string;
  workshopId: string;
  customerId: string;
  plate: string;
  plateNormalized?: string | null;
  make: string;
  model: string;
  year?: number | null;
  category?: string;
  color?: string | null;
  manufactureYear?: number | null;
  modelYear?: number | null;
  fuel?: string | null;
  engineDisplacement?: string | null;
  power?: string | null;
  municipality?: string | null;
  state?: string | null;
  maskedChassis?: string | null;
  lookupProvider?: string | null;
  lookupAt?: Date | null;
  lookupSnapshot?: Record<string, unknown> | null;
  odometer?: number | null;
};
export type ServiceCatalogSummary = {
  id: string;
  workshopId: string;
  name: string;
  defaultPriceCents: number;
  defaultReturnIntervalDays?: number | null;
  active: boolean;
};
export type ServiceSummary = {
  id: string;
  workshopId: string;
  customerId: string;
  serviceCatalogId?: string | null;
  customerName?: string;
  vehicleLabel?: string | null;
  description: string;
  amountCents: number;
  completedAt: Date;
  nextDueAt?: Date | null;
};
export type ServiceOrderPart = {
  id: string;
  name: string;
  unit: string;
  unitCostCents: number;
  quantity: number;
};
export type ServiceOrderDetails = {
  id: string;
  workshopId: string;
  customerId: string;
  serviceCatalogId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerWhatsappConsent: boolean;
  vehicleLabel?: string | null;
  description: string;
  amountCents: number;
  completedAt: Date | null;
  nextDueAt?: Date | null;
  odometer?: number | null;
  notes?: string | null;
  returnIntervalDays?: number | null;
  parts: ServiceOrderPart[];
};
export type InventorySummary = {
  id: string;
  workshopId: string;
  sku?: string | null;
  name: string;
  unit: string;
  costCents: number;
  salePriceCents: number;
  currentQuantity: number;
  reservedQuantity?: number;
  minimumQuantity: number;
  active: boolean;
};
export type ContactEventSummary = {
  id: string;
  workshopId: string;
  customerId: string;
  reason: string;
  message: string;
  contactedAt: Date;
};

export type InventoryConsumption = {
  inventoryItemId: string;
  quantity: number;
};
export type PersistedServiceInput = {
  workshopId: string;
  customerId: string;
  vehicleId: string | null;
  serviceCatalogId: string | null;
  description: string;
  amountCents: number;
  completedAt: Date;
  odometer: number | null;
  notes: string | null;
  returnIntervalDays: number | null;
  nextDueAt: Date | null;
};
export type ServiceWithInventoryInput = PersistedServiceInput & {
  inventory: InventoryConsumption[];
};

export interface CrmRepository {
  getWorkshopForUser(userId: string): Promise<WorkshopSummary | null>;
  createWorkshop(input: {
    ownerUserId: string;
    name: string;
    inactivityDays: number;
  }): Promise<WorkshopSummary>;
  updateWorkshop(input: WorkshopSummary): Promise<WorkshopSummary | null>;
  findCustomer(
    workshopId: string,
    customerId: string,
  ): Promise<CustomerSummary | null>;
  findVehicle(
    workshopId: string,
    vehicleId: string,
  ): Promise<VehicleSummary | null>;
  findServiceCatalogItem(
    workshopId: string,
    serviceCatalogId: string,
  ): Promise<ServiceCatalogSummary | null>;
  listCustomers(workshopId: string): Promise<CustomerSummary[]>;
  listVehicles(workshopId: string): Promise<VehicleSummary[]>;
  listServices(workshopId: string): Promise<ServiceSummary[]>;
  getServiceOrder(
    workshopId: string,
    serviceId: string,
  ): Promise<ServiceOrderDetails | null>;
  listServiceCatalog(workshopId: string): Promise<ServiceCatalogSummary[]>;
  listInventory(workshopId: string): Promise<InventorySummary[]>;
  listContactEvents(workshopId: string): Promise<ContactEventSummary[]>;
  createCustomer(
    input: Omit<
      CustomerSummary,
      "id" | "lastServiceAt" | "nextDueAt" | "vehicleCount"
    >,
  ): Promise<CustomerSummary>;
  updateCustomer(input: {
    workshopId: string;
    customerId: string;
    name: string;
    phone: string | null;
    phoneNormalized: string | null;
    email: string | null;
    document: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressComplement: string | null;
    addressDistrict: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressPostalCode: string | null;
    whatsappConsent: boolean;
    notes: string | null;
  }): Promise<CustomerSummary | null>;
  createVehicle(input: Omit<VehicleSummary, "id">): Promise<VehicleSummary>;
  createServiceCatalogItem(
    input: Omit<ServiceCatalogSummary, "id" | "active">,
  ): Promise<ServiceCatalogSummary>;
  recordService(input: PersistedServiceInput): Promise<ServiceSummary>;
  consumeInventoryAtomically(
    input: ServiceWithInventoryInput,
  ): Promise<ServiceSummary>;
  createInventoryItem(
    input: Omit<InventorySummary, "id" | "active">,
  ): Promise<InventorySummary>;
  adjustInventory(input: {
    workshopId: string;
    inventoryItemId: string;
    delta: number;
    note: string | null;
  }): Promise<InventorySummary>;
  recordContact(input: {
    workshopId: string;
    customerId: string;
    reason: string;
    message: string;
  }): Promise<ContactEventSummary>;
}
