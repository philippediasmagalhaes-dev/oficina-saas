import { describe, expect, it } from "vitest";
import { customerSchema, vehicleSchema, workshopSettingsSchema } from "./validators";

const customerId = "10000000-0000-4000-8000-000000000001";

describe("complete workshop record inputs", () => {
  it("preserves workshop identity and printable terms", () => {
    const parsed = workshopSettingsSchema.parse({
      name: "Paulinho Autocar",
      legalName: "Paulinho Autocar Serviços Ltda",
      document: "12.345.678/0001-90",
      phone: "(11) 97788-1220",
      whatsappNumber: "(11) 97788-1220",
      email: "paulinho@example.com",
      addressStreet: "Rua Exemplo",
      addressNumber: "123",
      addressComplement: "",
      addressDistrict: "Jardim Guarujá",
      addressCity: "São Paulo",
      addressState: "SP",
      addressPostalCode: "00000-000",
      printTerms: "Garantia de 90 dias.",
      inactivityDays: "180",
    });
    expect(parsed).toMatchObject({
      name: "Paulinho Autocar",
      document: "12.345.678/0001-90",
      addressState: "SP",
      printTerms: "Garantia de 90 dias.",
    });
  });

  it("records customer document, address and dated WhatsApp consent", () => {
    const parsed = customerSchema.parse({
      name: "Jean Carlos",
      phone: "(11) 97788-1220",
      email: "",
      document: "123.456.789-00",
      addressStreet: "Rua A",
      addressNumber: "12",
      addressComplement: "",
      addressDistrict: "Centro",
      addressCity: "São Paulo",
      addressState: "sp",
      addressPostalCode: "01000-000",
      whatsappConsent: "on",
      notes: "Cliente antigo",
    });
    expect(parsed).toMatchObject({
      document: "123.456.789-00",
      addressState: "SP",
      whatsappConsent: true,
    });
  });

  it("records complete vehicle details and normalizes its category", () => {
    const parsed = vehicleSchema.parse({
      customerId,
      plate: "fgy-0a18",
      make: "Chevrolet",
      model: "Corsa GL",
      category: "car",
      color: "Preta",
      manufactureYear: "1996",
      modelYear: "1997",
      year: "1997",
      fuel: "Gasolina",
      engineDisplacement: "1.6",
      power: "92 cv",
      municipality: "São Paulo",
      state: "sp",
      maskedChassis: "*****VC733712",
      odometer: "123456",
    });
    expect(parsed).toMatchObject({
      plate: "FGY0A18",
      category: "car",
      modelYear: 1997,
      state: "SP",
      maskedChassis: "*****VC733712",
    });
  });
});
