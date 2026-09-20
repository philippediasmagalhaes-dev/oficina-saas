import type { CrmRepository, ServiceWithInventoryInput } from "./ports";

export function createCrmService(repository: CrmRepository) {
  return {
    async recordService(input: ServiceWithInventoryInput) {
      const customer = await repository.findCustomer(input.workshopId, input.customerId);
      if (!customer) throw new Error("Registro não encontrado");

      if (input.vehicleId) {
        const vehicle = await repository.findVehicle(input.workshopId, input.vehicleId);
        if (!vehicle || vehicle.customerId !== input.customerId) throw new Error("Registro não encontrado");
      }

      if (input.inventory.length > 0) return repository.consumeInventoryAtomically(input);
      const { inventory: _inventory, ...service } = input;
      return repository.recordService(service);
    },
  };
}
