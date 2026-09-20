import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { readServerConfig } from "../../../db/config";
import { formatCents } from "../../../domain/money";
import { buildServiceReadyDraft } from "../../../domain/outreach";
import { getServiceOrder } from "../../../server/queries";
import { notifyServiceReadyAction } from "../../actions";
import { ConfigurationPending } from "../../configurar/page";

function formatDate(date?: Date | null) {
  return date?.toLocaleDateString("pt-BR") ?? "Não definido";
}

export default async function ServiceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const { id } = await params;
  const data = await getServiceOrder(id);
  if (!data.order) notFound();
  const order = data.order;
  const draft = buildServiceReadyDraft({
    phone: order.customerPhone ?? null,
    consent: order.customerWhatsappConsent,
    customer: order.customerName,
    workshop: data.workshop.name,
    vehicle: order.vehicleLabel,
  });

  return (
    <AppShell workshopName={data.workshop.name} current="/servicos">
      <div className="order-heading">
        <div>
          <Link className="back-link" href="/servicos">
            ← Voltar para serviços
          </Link>
          <p className="eyebrow">
            ORDEM DE SERVIÇO · #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <h1>{order.description}</h1>
          <p>
            {order.customerName}
            {order.vehicleLabel
              ? ` · ${order.vehicleLabel}`
              : " · Sem veículo vinculado"}
          </p>
        </div>
        <span className="ready-status">
          <i />
          Pronto
        </span>
      </div>
      <div className="order-layout">
        <div>
          <section className="surface order-summary">
            <div className="order-total">
              <span>Valor do serviço</span>
              <strong>{formatCents(order.amountCents)}</strong>
            </div>
            <div className="order-details">
              <div>
                <span>Cliente</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span>Veículo</span>
                <strong>{order.vehicleLabel ?? "Não vinculado"}</strong>
              </div>
              <div>
                <span>Concluído em</span>
                <strong>{formatDate(order.completedAt)}</strong>
              </div>
              <div>
                <span>Quilometragem</span>
                <strong>
                  {order.odometer
                    ? `${order.odometer.toLocaleString("pt-BR")} km`
                    : "Não informada"}
                </strong>
              </div>
              <div>
                <span>Próximo retorno</span>
                <strong>{formatDate(order.nextDueAt)}</strong>
              </div>
              <div>
                <span>Intervalo sugerido</span>
                <strong>
                  {order.returnIntervalDays
                    ? `${order.returnIntervalDays} dias`
                    : "Não definido"}
                </strong>
              </div>
            </div>
            {order.notes ? (
              <div className="order-notes">
                <span>Observações</span>
                <p>{order.notes}</p>
              </div>
            ) : null}
          </section>
          <section className="surface">
            <div className="section-title">
              <div>
                <span>Estoque</span>
                <h2>Itens utilizados</h2>
              </div>
            </div>
            {order.parts.length ? (
              <div className="parts-list">
                {order.parts.map((part) => (
                  <div key={part.id}>
                    <span>
                      <strong>{part.name}</strong>
                      <small>
                        {formatCents(part.unitCostCents)} por {part.unit}
                      </small>
                    </span>
                    <b>
                      {part.quantity} {part.unit}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted order-empty-copy">
                Nenhum item do estoque foi vinculado a esta ordem.
              </p>
            )}
          </section>
        </div>
        <aside className="surface ready-card">
          <div>
            <p className="eyebrow">AVISAR CLIENTE</p>
            <h2>Veículo pronto para retirada</h2>
            <p>
              A mensagem será aberta no WhatsApp para você revisar e confirmar o
              envio.
            </p>
          </div>
          {draft ? (
            <>
              <div className="message-preview">
                <small>Prévia da mensagem</small>
                <p>{draft.message}</p>
              </div>
              <form action={notifyServiceReadyAction}>
                <input type="hidden" name="serviceId" value={order.id} />
                <button className="primary-button" type="submit">
                  Avisar que está pronto
                </button>
              </form>
            </>
          ) : (
            <div className="contact-warning">
              <strong>WhatsApp indisponível</strong>
              <p>
                Adicione um telefone válido e autorize o contato no cadastro do
                cliente.
              </p>
              <Link className="secondary-button" href="/clientes">
                Ver clientes
              </Link>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
