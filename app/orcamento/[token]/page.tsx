import { notFound } from "next/navigation";
import { formatCents } from "../../../domain/money";
import { getPublicQuote } from "../../../server/work-orders";
import { respondToQuoteAction } from "../../actions";

export default async function PublicQuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ resposta?: string }> }) {
  const { token } = await params;
  const { resposta } = await searchParams;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();
  const answered = quote.quoteStatus === "approved" || quote.quoteStatus === "rejected";
  const expired = quote.quoteValidUntil ? quote.quoteValidUntil < new Date() : false;

  return <main className="public-quote-page">
    <article className="public-quote-card">
      <header><img src="/logo.jpg" alt="Logo" /><div><span>ORÇAMENTO DIGITAL</span><strong>{quote.workshopName}</strong></div></header>
      {resposta || answered ? <div className={`quote-response ${quote.quoteStatus}`}><strong>{quote.quoteStatus === "approved" ? "Orçamento aprovado" : "Orçamento recusado"}</strong><p>{quote.quoteStatus === "approved" ? "A oficina já pode iniciar o serviço autorizado." : "A oficina recebeu sua resposta e poderá entrar em contato."}</p></div> : null}
      <section><p className="eyebrow">CLIENTE E MOTO</p><h1>{quote.customerName}</h1><p>{quote.vehicleLabel ?? "Moto não informada"}</p></section>
      <section className="public-diagnosis"><div><span>Relato</span><p>{quote.complaint ?? "Não informado"}</p></div><div><span>Diagnóstico</span><p>{quote.diagnosis ?? "Aguardando diagnóstico"}</p></div></section>
      <section><div className="section-title"><div><span>Itens propostos</span><h2>Serviços e peças</h2></div></div><div className="public-quote-lines">{quote.items.map((item) => <div key={item.id}><span><strong>{item.description}</strong><small>{item.quantity} × {formatCents(item.unitPriceCents)}</small></span><b>{formatCents(item.quantity * item.unitPriceCents)}</b></div>)}</div><div className="public-total"><span>Subtotal <b>{formatCents(quote.subtotalCents)}</b></span>{quote.quoteDiscountCents ? <span>Desconto <b>− {formatCents(quote.quoteDiscountCents)}</b></span> : null}<strong>Total <b>{formatCents(quote.amountCents)}</b></strong></div></section>
      {quote.quoteValidUntil ? <p className="quote-validity">Válido até {quote.quoteValidUntil.toLocaleDateString("pt-BR")}</p> : null}
      {!answered && !expired && quote.quoteStatus === "sent" ? <section className="quote-decision"><h2>Autoriza a execução?</h2><p>Sua resposta ficará registrada com data e hora.</p><div><form action={respondToQuoteAction}><input type="hidden" name="token" value={token} /><input type="hidden" name="response" value="approved" /><button className="primary-button" type="submit">Aprovar orçamento</button></form><form action={respondToQuoteAction}><input type="hidden" name="token" value={token} /><input type="hidden" name="response" value="rejected" /><button className="secondary-button" type="submit">Recusar</button></form></div></section> : null}
      {quote.quoteStatus === "draft" ? <div className="quote-response rejected"><strong>Orçamento em preparação</strong><p>A oficina ainda está finalizando os itens desta proposta.</p></div> : null}
      {expired && !answered ? <div className="quote-response rejected"><strong>Orçamento expirado</strong><p>Entre em contato com a oficina para solicitar uma atualização.</p></div> : null}
      <footer>Documento digital da ordem #{quote.id.slice(0, 8).toUpperCase()}</footer>
    </article>
  </main>;
}
