import { describe, expect, it, vi } from "vitest";
import { createCrmService } from "./crm-service";
import type { CrmRepository } from "./ports";

function fakeRepository(overrides: Partial<CrmRepository> = {}): CrmRepository {
  return {
    getWorkshopForUser: vi.fn(),
    createWorkshop: vi.fn(),
    findCustomer: vi.fn(async () => ({
      id: "customer-a",
      workshopId: "workshop-a",
      name: "Ana",
    })),
    findVehicle: vi.fn(async () => null),
    findServiceCatalogItem: vi.fn(async () => ({
      id: "catalog-a",
      workshopId: "workshop-a",
      name: "Revisão",
      defaultPriceCents: 30000,
      defaultReturnIntervalDays: 180,
      active: true,
    })),
    listCustomers: vi.fn(async () => []),
    listVehicles: vi.fn(async () => []),
    listServices: vi.fn(async () => []),
    getServiceOrder: vi.fn(async () => null),
    listServiceCatalog: vi.fn(async () => []),
    listInventory: vi.fn(async () => []),
    listContactEvents: vi.fn(async () => []),
    createCustomer: vi.fn(),
    createVehicle: vi.fn(),
    createServiceCatalogItem: vi.fn(),
    recordService: vi.fn(async (input) => ({ id: "service-a", ...input })),
    consumeInventoryAtomically: vi.fn(async (input) => ({
      id: "service-a",
      ...input,
    })),
    createInventoryItem: vi.fn(),
    adjustInventory: vi.fn(),
    recordContact: vi.fn(),
    ...overrides,
  };
}

const validInput = {
  workshopId: "workshop-a",
  customerId: "customer-a",
  vehicleId: null,
  serviceCatalogId: "catalog-a",
  description: "Revisão",
  amountCents: 30000,
  completedAt: new Date("2026-09-20T12:00:00Z"),
  odometer: null,
  notes: null,
  returnIntervalDays: null,
  nextDueAt: null,
  inventory: [] as { inventoryItemId: string; quantity: number }[],
};

describe("tenant-scoped CRM service", () => {
  it("rejects a customer outside the authenticated workshop", async () => {
    const repository = fakeRepository({
      findCustomer: vi.fn(async () => null),
    });
    await expect(
      createCrmService(repository).recordService(validInput),
    ).rejects.toThrow("Registro não encontrado");
    expect(repository.recordService).not.toHaveBeenCalled();
  });

  it("rejects a vehicle outside the authenticated workshop", async () => {
    const repository = fakeRepository();
    await expect(
      createCrmService(repository).recordService({
        ...validInput,
        vehicleId: "vehicle-b",
      }),
    ).rejects.toThrow("Registro não encontrado");
    expect(repository.recordService).not.toHaveBeenCalled();
  });

  it("rejects a catalog item outside the authenticated workshop", async () => {
    const repository = fakeRepository({
      findServiceCatalogItem: vi.fn(async () => null),
    });
    await expect(
      createCrmService(repository).recordService(validInput),
    ).rejects.toThrow("Registro não encontrado");
    expect(repository.recordService).not.toHaveBeenCalled();
  });

  it("uses the atomic path whenever a service consumes stock", async () => {
    const repository = fakeRepository({
      consumeInventoryAtomically: vi.fn(async () => {
        throw new Error("Estoque insuficiente");
      }),
    });
    await expect(
      createCrmService(repository).recordService({
        ...validInput,
        inventory: [{ inventoryItemId: "part-a", quantity: 3 }],
      }),
    ).rejects.toThrow("Estoque insuficiente");
    expect(repository.recordService).not.toHaveBeenCalled();
    expect(repository.consumeInventoryAtomically).toHaveBeenCalledOnce();
  });
});
