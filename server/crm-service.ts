import type { CrmRepository, ServiceWithInventoryInput } from "./ports";

export function createCrmService(repository: CrmRepository) {
  return {
    async recordService(input: ServiceWithInventoryInput) {
      const customer = await repository.findCustomer(input.workshopId, input.customerId);
      if (!customer) throw new Error("Registro não encontrado");

      if (!input.serviceCatalogId) throw new Error("Selecione um serviço cadastrado");
      const catalogItem = await repository.findServiceCatalogItem(input.workshopId, input.serviceCatalogId);
      if (!catalogItem || !catalogItem.active) throw new Error("Registro não encontrado");

      if (input.vehicleId) {
        const vehicle = await repository.findVehicle(input.workshopId, input.vehicleId);
        if (!vehicle || vehicle.customerId !== input.customerId) throw new Error("Registro não encontrado");
      }

      const normalized = { ...input, description: catalogItem.name };
      if (normalized.inventory.length > 0) return repository.consumeInventoryAtomically(normalized);
      const { inventory: _inventory, ...service } = normalized;
      return repository.recordService(service);
    },
  };
}
