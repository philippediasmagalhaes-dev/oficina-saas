import { notFound } from "next/navigation";
import { PrintButton } from "../../../../components/print-button";
import { readServerConfig } from "../../../../db/config";
import { formatCents } from "../../../../domain/money";
import { formatOptionalDate } from "../../../../domain/dates";
import { formatWorkOrderNumber } from "../../../../domain/workshop-settings";
import { getWorkOrderData } from "../../../../server/queries";
import { ConfigurationPending } from "../../../configurar/page";
import "./print.css";

type Party = { name: string; legalName?: string | null; document?: string | null; phone?: string | null; email?: string | null; addressStreet?: string | null; addressNumber?: string | null; addressDistrict?: string | null; addressCity?: string | null; addressState?: string | null; addressPostalCode?: string | null; printTerms?: string | null };
type Vehicle = { plate: string; make: string; model: string; manufactureYear?: number | null; modelYear?: number | null; year?: number | null; color?: string | null; fuel?: string | null; maskedChassis?: string | null };
type PrintableOrder = { id: string; orderNumber: number | null; intakeAt: Date | null; createdAt: Date; complaint: string | null; diagnosis: string | null; notes: string | null; odometer: number | null; deliveredOdometer: number | null; warrantyDays: number | null; subtotalCents: number; quoteDiscountCents: number; amountCents: number; items: Array<{ id: string; type: "service" | "part"; description: string; quantity: number; unitPriceCents: number }>; photos: Array<{ id: string; kind: string; caption: string | null; fileName: string }>; inspection: null | { fuelLevel: string | null; tireCondition: string | null; observations: string | null; checklist: Record<string, boolean>; marks: Array<{ id: string; damageType: string; vehicleView: string; note: string | null }> } };
type Payment = { id: string; paymentMethod: string; amountCents: number; feeAmountCents: number; netAmountCents: number; status: string; installmentCount?: number };

const paymentLabels: Record<string, string> = { pix: "PIX", cash: "Dinheiro", debit_card: "Débito", credit_card: "Crédito", transfer: "Transferência", other: "Outro", split: "Dividido" };
const checklistLabels: Record<string, string> = { documents: "Documentos", spare_tire: "Estepe", jack: "Macaco", wheel_wrench: "Chave de roda", radio: "Som", antenna: "Antena", extinguisher: "Extintor" };

function address(value: Party) { return [value.addressStreet, value.addressNumber, value.addressDistrict, value.addressCity, value.addressState, value.addressPostalCode].filter(Boolean).join(" · "); }

export function PrintableWorkOrder({ workshop, customer, vehicle, order, payments }: { workshop: Party; customer: Party; vehicle: Vehicle | null; order: PrintableOrder; payments: Payment[] }) {
  return <main className="print-root">
    <div className="print-actions"><a href={`/ordens/${order.id}`}>← Voltar para OS</a><PrintButton /></div>
    <header className="print-header"><img src="/logo.jpg" alt={`Logo ${workshop.name}`} /><div><h1>{workshop.name}</h1><p>{workshop.legalName}{workshop.document ? ` · ${workshop.document}` : ""}</p><p>{address(workshop)}</p><p>{[workshop.phone, workshop.email].filter(Boolean).join(" · ")}</p></div><strong>{order.orderNumber ? formatWorkOrderNumber(order.orderNumber) : `OS #${order.id.slice(0, 8).toUpperCase()}`}</strong></header>
    <section className="print-title"><h2>ORDEM DE SERVIÇO</h2><span>Entrada: {formatOptionalDate(order.intakeAt)}</span></section>
    <section className="print-grid print-party"><div><span>Cliente</span><strong>{customer.name}</strong></div><div><span>Telefone</span><strong>{customer.phone || "—"}</strong></div><div className="wide"><span>Endereço</span><strong>{address(customer) || "—"}</strong></div><div><span>CPF/CNPJ</span><strong>{customer.document || "—"}</strong></div></section>
    <section className="print-grid print-vehicle"><div><span>Veículo</span><strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : "—"}</strong></div><div><span>Placa</span><strong>{vehicle?.plate || "—"}</strong></div><div><span>Ano</span><strong>{vehicle ? [vehicle.manufactureYear, vehicle.modelYear ?? vehicle.year].filter(Boolean).join("/") : "—"}</strong></div><div><span>Cor / combustível</span><strong>{[vehicle?.color, vehicle?.fuel].filter(Boolean).join(" · ") || "—"}</strong></div><div><span>Chassi</span><strong>{vehicle?.maskedChassis || "—"}</strong></div><div><span>Quilometragem</span><strong>{(order.deliveredOdometer ?? order.odometer)?.toLocaleString("pt-BR") ?? "—"} km</strong></div></section>
    <section className="print-inspection"><div><h3>Vistoria de entrada</h3><p><b>Combustível:</b> {order.inspection?.fuelLevel || "—"} · <b>Pneus:</b> {order.inspection?.tireCondition || "—"}</p><div className="print-checklist">{Object.entries(order.inspection?.checklist ?? {}).map(([key, checked]) => <span key={key}>[{checked ? "X" : " "}] {checklistLabels[key] ?? key.replaceAll("_", " ")}</span>)}</div><p><b>Observações:</b> {order.inspection?.observations || "—"}</p></div><div><h3>Danos assinalados</h3>{order.inspection?.marks.length ? <ul>{order.inspection.marks.map((mark) => <li key={mark.id}>{mark.damageType} · {mark.vehicleView}{mark.note ? ` — ${mark.note}` : ""}</li>)}</ul> : <p>Nenhum dano registrado.</p>}</div></section>
    <section className="print-text"><h3>Defeito / reclamação</h3><p>{order.complaint || "—"}</p><h3>Diagnóstico</h3><p>{order.diagnosis || "—"}</p>{order.notes ? <><h3>Observações</h3><p>{order.notes}</p></> : null}</section>
    <section><h3>Serviços e peças</h3><table className="print-table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.type === "service" ? "Mão de obra" : "Peça"}</td><td>{item.description}</td><td>{item.quantity}</td><td>{formatCents(item.unitPriceCents)}</td><td>{formatCents(item.quantity * item.unitPriceCents)}</td></tr>)}</tbody><tfoot><tr><td colSpan={4}>Subtotal</td><td>{formatCents(order.subtotalCents)}</td></tr><tr><td colSpan={4}>Desconto</td><td>− {formatCents(order.quoteDiscountCents)}</td></tr><tr><td colSpan={4}>TOTAL</td><td>{formatCents(order.amountCents)}</td></tr></tfoot></table></section>
    <section className="print-split"><div><h3>Pagamento</h3>{payments.length ? payments.map((payment) => <p key={payment.id}>{paymentLabels[payment.paymentMethod] ?? payment.paymentMethod}{payment.installmentCount && payment.installmentCount > 1 ? ` · ${payment.installmentCount}x` : ""} — {formatCents(payment.amountCents)} ({payment.status === "paid" ? "pago" : "previsto"}){payment.feeAmountCents ? ` · taxa ${formatCents(payment.feeAmountCents)}` : ""}</p>) : <p>Não registrado.</p>}</div><div><h3>Evidências fotográficas</h3>{order.photos.length ? <div className="print-photos">{order.photos.map((photo) => <figure key={photo.id}><img src={`/api/photos/${photo.id}`} alt={photo.caption || photo.fileName} /><figcaption>{photo.fileName}{photo.caption ? ` · ${photo.caption}` : ""}</figcaption></figure>)}</div> : <p>Sem fotos anexadas.</p>}</div></section>
    <section className="print-terms"><h3>Condições e garantia</h3><p>{workshop.printTerms || `Garantia informada: ${order.warrantyDays ?? 90} dias, conforme serviços e peças descritos nesta ordem.`}</p></section>
    <footer className="print-signatures"><div><span>Assinatura do cliente</span><strong>{customer.name}</strong></div><div><span>Responsável pela oficina</span><strong>{workshop.name}</strong></div></footer>
  </main>;
}

export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const config = readServerConfig(process.env);
  if (!config.configured) return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getWorkOrderData(id);
  if (!data.order || !data.customer) notFound();
  return <PrintableWorkOrder workshop={data.workshop} customer={data.customer} vehicle={data.vehicle} order={data.order} payments={data.payments} />;
}
