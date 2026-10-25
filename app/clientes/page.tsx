import { AppShell } from "../../components/app-shell";
import { CustomerForm } from "../../components/forms";
import { EmptyState } from "../../components/empty-state";
import { PaginationNav } from "../../components/pagination-nav";
import { readServerConfig } from "../../db/config";
import { normalizePageRequest } from "../../domain/pagination";
import { ConfigurationPending } from "../configurar/page";
import { getCustomers } from "../../server/queries";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const { q = "", page } = await searchParams;
  const data = await getCustomers({
    query: q,
    ...normalizePageRequest({ page }),
  });
  const customers = data.customers;

  return (
    <AppShell workshopName={data.workshop.name} current="/clientes">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CLIENTES</p>
          <h1>Uma base que trabalha por você.</h1>
          <p>Cadastre contatos, consentimento e encontre cada cliente rapidamente.</p>
        </div>
        <a className="primary-button" href="#novo">
          Novo cliente
        </a>
      </div>
      <section className="surface filter-surface">
        <form className="vehicle-search" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, telefone, documento ou e-mail"
            aria-label="Pesquisar cliente"
          />
          <button className="secondary-button" type="submit">
            Buscar
          </button>
          {q ? (
            <a className="secondary-button" href="/clientes">
              Limpar
            </a>
          ) : null}
        </form>
      </section>
      <section className="surface compact-list-surface">
        <div className="section-title">
          <div>
            <span>{customers.total} cadastrados</span>
            <h2>Clientes da oficina</h2>
          </div>
          <a className="table-link" href="/veiculos?nova=1#novo">
            Cadastrar veículo
          </a>
        </div>
        {customers.items.length ? (
          <div className="card-list compact-card-list">
            {customers.items.map((customer) => (
              <article className="list-card" key={customer.id}>
                <div className="avatar">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{customer.name}</strong>
                  <p>{customer.phone || customer.email || "Sem contato informado"}</p>
                </div>
                <div className="list-actions">
                  <div className="list-meta">
                    <span>{customer.vehicleCount ?? 0} veículo(s)</span>
                    <small>
                      {customer.whatsappConsent
                        ? "WhatsApp autorizado"
                        : "Sem autorização WhatsApp"}
                    </small>
                  </div>
                  <a className="table-link" href={`/clientes/${customer.id}/editar`}>
                    Editar
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={q ? "Nenhum cliente encontrado" : "Sua base começa aqui"}
            description={
              q
                ? "Revise o termo pesquisado ou limpe a busca."
                : "Cadastre o primeiro cliente atendido pela oficina."
            }
          />
        )}
        <PaginationNav
          pathname="/clientes"
          query={q}
          page={customers.page}
          pageCount={customers.pageCount}
          previousPage={customers.previousPage}
          nextPage={customers.nextPage}
        />
      </section>
      <section className="surface" id="novo">
        <div className="section-title">
          <div>
            <span>Novo cadastro</span>
            <h2>Cliente</h2>
          </div>
        </div>
        <CustomerForm />
      </section>
    </AppShell>
  );
}
