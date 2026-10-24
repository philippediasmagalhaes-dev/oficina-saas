import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrintableWorkOrder } from "./page";

describe("printable work order", () => {
  it("renders the complete A4 workshop record without Wi-Fi credentials", () => {
    const html = renderToStaticMarkup(<PrintableWorkOrder
      workshop={{ name: "Paulinho Autocar", legalName: "Paulinho Auto Car", document: "00.000.000/0001-00", phone: "11999990000", email: "oficina@example.com", addressStreet: "Rua Teste", addressNumber: "10", addressDistrict: "Centro", addressCity: "São Paulo", addressState: "SP", addressPostalCode: "00000-000", printTerms: "Garantia de 90 dias." }}
      customer={{ name: "Ana", phone: "11988887777", document: "123", addressStreet: "Rua Cliente", addressNumber: "20", addressDistrict: "Bairro", addressCity: "São Paulo", addressState: "SP" }}
      vehicle={{ plate: "ABC1D23", make: "Chevrolet", model: "Onix", manufactureYear: 2020, modelYear: 2021, color: "Preto", fuel: "Flex", maskedChassis: "********12345" }}
      order={{ id: "order", orderNumber: 1281, intakeAt: new Date("2026-10-23T12:00:00Z"), createdAt: new Date("2026-10-23T12:00:00Z"), complaint: "Vazamento de óleo", diagnosis: "Junta danificada", notes: "Sem observações", odometer: 100000, deliveredOdometer: 100010, warrantyDays: 90, subtotalCents: 25000, quoteDiscountCents: 1000, amountCents: 24000, items: [{ id: "labor", type: "service", description: "Troca da junta", quantity: 1, unitPriceCents: 15000 }, { id: "part", type: "part", description: "Junta", quantity: 1, unitPriceCents: 10000 }], photos: [{ id: "photo", kind: "intake", caption: "Entrada", fileName: "entrada.jpg" }], inspection: { fuelLevel: "1/2", tireCondition: "bons", observations: "Risco lateral", checklist: { documents: true }, marks: [{ id: "mark", damageType: "scratch", vehicleView: "left", note: "Porta" }] } }}
      payments={[{ id: "pay", paymentMethod: "pix", amountCents: 24000, feeAmountCents: 0, netAmountCents: 24000, status: "paid" }]}
    />);
    for (const text of ["Paulinho Autocar", "OS Nº 1281", "Ana", "ABC1D23", "Vazamento de óleo", "Junta danificada", "Troca da junta", "Risco lateral", "entrada.jpg", "PIX", "Garantia de 90 dias", "Assinatura do cliente"]) expect(html).toContain(text);
    expect(html).not.toMatch(/senha|chave web|wi-fi/i);
  });
});
