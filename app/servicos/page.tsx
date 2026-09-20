import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { ServiceCatalogForm } from "../../components/forms";
import { readServerConfig } from "../../db/config";
import { formatCents } from "../../domain/money";
import { getServiceRecords } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function ServicesPage() {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const data = await getServiceRecords();
  return (
    <AppShell workshopName={data.workshop.name} current="/servicos">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGO</p>
          <h1>Serviços padronizados, orçamentos mais rápidos.</h1>
          <p>
            Defina preço e retorno sugerido para reutilizar em todas as ordens.
          </p>
        </div>
      </div>
      <div className="split-grid">
        <section className="surface" id="catalogo">
          <div className="section-title">
            <div>
              <span>Catálogo</span>
              <h2>Cadastrar serviço</h2>
            </div>
          </div>
          <ServiceCatalogForm />
        </section>
        <section className="surface">
          <div className="section-title">
            <div>
              <span>{data.catalog.length} cadastrados</span>
              <h2>Serviços oferecidos</h2>
            </div>
          </div>
          {data.catalog.length ? (
            <div className="catalog-list">
              {data.catalog.map((item) => (
                <div className="catalog-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.defaultReturnIntervalDays
                        ? `Retorno sugerido em ${item.defaultReturnIntervalDays} dias`
                        : "Sem retorno definido"}
                    </small>
                  </div>
                  <b>{formatCents(item.defaultPriceCents)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Catálogo vazio"
              description="Cadastre o primeiro serviço para usá-lo nos atendimentos."
            />
          )}
        </section>
      </div>
      <section className="surface">
        <div className="section-title">
          <div>
            <span>{data.services.length} registros</span>
            <h2>Serviços entregues</h2>
          </div>
        </div>
        {data.services.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Concluído em</th>
                  <th>Próximo retorno</th>
                  <th>Valor</th>
                  <th>OS</th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.customerName}</strong>
                      <small>{service.vehicleLabel ?? "Sem veículo"}</small>
                    </td>
                    <td>{service.description}</td>
                    <td>{service.completedAt.toLocaleDateString("pt-BR")}</td>
                    <td>
                      {service.nextDueAt?.toLocaleDateString("pt-BR") ??
                        "Não definido"}
                    </td>
                    <td>{formatCents(service.amountCents)}</td>
                    <td>
                      <a
                        className="table-link"
                        href={`/ordens/${service.id}`}
                      >
                        Ver detalhes
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nenhum serviço ainda"
            description="Quando registrar um serviço, o histórico aparecerá aqui."
          />
        )}
      </section>
    </AppShell>
  );
}
