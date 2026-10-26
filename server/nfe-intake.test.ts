import { describe, expect, it } from "vitest";
import { buildInvoiceFinancialDraft, validateInvoiceReview } from "./nfe-intake";

const xml = `<NFe><infNFe Id="NFe${"1".repeat(44)}"><ide><nNF>1</nNF></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Peças</xNome></emit><det nItem="1"><prod><cProd>1</cProd><xProd>Óleo</xProd><uCom>CX</uCom><qCom>1</qCom><vProd>120.00</vProd></prod></det></infNFe></NFe>`;

describe("reviewed invoice intake", () => {
  it("converts reviewed units while retaining the invoice total", () => {
    const result = validateInvoiceReview(xml, [{ line: 1, quantity: 12, inventoryItemId: null, include: true }]);
    expect(result.items[0]).toMatchObject({ quantity: 12, totalCents: 12000, unitCostCents: 1000 });
  });
  it("rejects missing review, fractional inventory, and cross-form IDs", () => {
    expect(() => validateInvoiceReview(xml, [])).toThrow("Revise");
    expect(() => validateInvoiceReview(xml, [{ line: 1, quantity: 1.5, inventoryItemId: null, include: true }])).toThrow("inteiras");
    expect(() => validateInvoiceReview(xml, [{ line: 1, quantity: 1, inventoryItemId: "bad-id", include: true }])).toThrow("inválido");
  });
  it("builds one stable supplier payable identity per invoice", () => {
    const invoice = validateInvoiceReview(xml, [{ line: 1, quantity: 12, inventoryItemId: null, include: true }]);
    const first = buildInvoiceFinancialDraft(invoice, new Date("2026-11-10T00:00:00Z"));
    const retry = buildInvoiceFinancialDraft(invoice, new Date("2026-11-10T00:00:00Z"));
    expect(first).toEqual(retry);
    expect(first).toMatchObject({
      externalId: `nfe:${"1".repeat(44)}:payable`,
      supplierDocument: "12345678000199",
      amountCents: 12_000,
    });
  });
});
