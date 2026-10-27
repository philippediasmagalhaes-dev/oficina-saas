import { XMLParser, XMLValidator } from "fast-xml-parser";

export type NfeItem = { line: number; code: string; name: string; unit: string; quantity: number; totalCents: number };
export type NfeDocument = { key: string; number: string; supplier: string; supplierDocument: string; totalCents: number; items: NfeItem[] };

export function parseNfe(xml: string): NfeDocument {
  if (xml.length > 250000) throw new Error("Use um XML de até 250 KB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML com declarações externas não permitido.");
  if (XMLValidator.validate(xml) !== true) throw new Error("XML inválido.");
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true, processEntities: true }).parse(xml);
  const info = (parsed.nfeProc?.NFe ?? parsed.NFe)?.infNFe;
  if (!info) throw new Error("Selecione o XML de uma NF-e.");
  const key = String(info["@_Id"] ?? "").replace(/^NFe/, "");
  if (!/^\d{44}$/.test(key)) throw new Error("NF-e sem chave válida.");
  const details = Array.isArray(info.det) ? info.det : info.det ? [info.det] : [];
  if (!details.length || details.length > 50) throw new Error("A nota deve ter de 1 a 50 produtos.");
  const items = details.map((detail: { "@_nItem": string; prod?: Record<string, string> }) => {
    const product = detail.prod ?? {};
    const quantity = Number(product.qCom);
    const totalCents = Math.round(Number(product.vProd) * 100);
    const line = Number(detail["@_nItem"]);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Quantidade inválida na nota.");
    if (!Number.isSafeInteger(totalCents) || totalCents < 0 || !Number.isInteger(line) || line < 1) throw new Error("Produto inválido na nota.");
    if (!product.xProd || !product.cProd) throw new Error("Produto sem descrição ou código.");
    return { line, code: String(product.cProd).slice(0, 80), name: String(product.xProd).slice(0, 200), unit: String(product.uCom ?? "un").slice(0, 10), quantity, totalCents };
  });
  if (new Set(items.map((item: NfeItem) => item.line)).size !== items.length) throw new Error("Linhas duplicadas na nota.");
  const declaredTotalCents = Math.round(Number(info.total?.ICMSTot?.vNF) * 100);
  const totalCents = Number.isSafeInteger(declaredTotalCents) && declaredTotalCents > 0
    ? declaredTotalCents
    : items.reduce((sum: number, item: NfeItem) => sum + item.totalCents, 0);
  return { key, number: String(info.ide?.nNF ?? ""), supplier: String(info.emit?.xNome ?? "Fornecedor"), supplierDocument: String(info.emit?.CNPJ ?? info.emit?.CPF ?? ""), totalCents, items };
}
