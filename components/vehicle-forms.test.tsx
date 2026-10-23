import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VehicleEditForm, VehicleForm } from "./forms";
import { WorkOrderForm } from "./work-order-form";

const customers = [
  {
    id: "customer-1",
    workshopId: "workshop-1",
    name: "Cliente Teste",
    phone: null,
    email: null,
    notes: null,
    whatsappConsent: true,
    lastServiceAt: null,
    nextDueAt: null,
    serviceCount: 0,
    totalSpentCents: 0,
  },
];

const vehicle = {
  id: "vehicle-1",
  workshopId: "workshop-1",
  customerId: "customer-1",
  customerName: "Cliente Teste",
  plate: "ABC1D23",
  make: "Chevrolet",
  model: "Corsa",
  year: 1997,
  odometer: 120000,
};

describe("vehicle language in owner forms", () => {
  it("uses vehicle wording in create and edit forms", () => {
    const html = renderToStaticMarkup(
      <>
        <VehicleForm customers={customers} />
        <VehicleEditForm vehicle={vehicle} customers={customers} />
      </>,
    );

    expect(html).toContain("Adicionar veículo");
    expect(html).toContain("Salvar veículo");
    expect(html).not.toMatch(/mo(?:to|tos)/i);
  });

  it("asks for a vehicle when opening a work order", () => {
    const html = renderToStaticMarkup(
      <WorkOrderForm customers={customers} vehicles={[vehicle]} />,
    );

    expect(html).toContain("Veículo");
    expect(html).toContain("Selecione o veículo");
    expect(html).not.toMatch(/mo(?:to|tos)/i);
  });
});
