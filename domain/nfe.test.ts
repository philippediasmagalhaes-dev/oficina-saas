import { describe, expect, it } from "vitest";
import { parseNfe } from "./nfe";

const key = "1".repeat(44);
const xml = `<nfeProc><NFe><infNFe Id="NFe${key}"><ide><nNF>123</nNF></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor &amp; Cia</xNome></emit><det nItem="1"><prod><cProd>OLEO</cProd><xProd>Óleo 5W30</xProd><uCom>UN</uCom><qCom>12.0000</qCom><vProd>600.00</vProd></prod></det></infNFe></NFe></nfeProc>`;

describe("NF-e stock intake", () => {
  it("reads product totals and quantities without losing identifiers", () => {
    expect(parseNfe(xml)).toEqual({ key, number: "123", supplier: "Fornecedor & Cia", supplierDocument: "12345678000199", totalCents: 60000, items: [{ line: 1, code: "OLEO", name: "Óleo 5W30", unit: "UN", quantity: 12, totalCents: 60000 }] });
  });
  it("rejects malformed XML and external entity declarations", () => {
    expect(() => parseNfe("<broken>")).toThrow();
    expect(() => parseNfe(`<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///secret'>]>${xml}`)).toThrow("declarações");
  });
  it("rejects documents with missing invoice key or invalid quantities", () => {
    expect(() => parseNfe(xml.replace(`NFe${key}`, "bad"))).toThrow("chave");
    expect(() => parseNfe(xml.replace("12.0000", "0"))).toThrow("Quantidade");
  });
});
