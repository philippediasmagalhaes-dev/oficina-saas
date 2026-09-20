import { ConfigurationPending } from "./configurar/page";
import { readServerConfig } from "../db/config";
import { formatCents } from "../domain/money";
import { AppShell } from "../components/app-shell";
import { EmptyState } from "../components/empty-state";
import { getDashboardData } from "../server/queries";

export default async function Home() {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const data = await getDashboardData();
  return (
    <AppShell workshopName={data.workshop.name} current="/">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Seu relacionamento com clientes, em dia.</h1>
          <p>
            Veja receita registrada, retornos e o que precisa da sua atenção.
          </p>
        </div>
        <a className="primary-button" href="/servicos#novo">
          Registrar serviço
        </a>
      </div>
      <section className="metric-grid">
        <article className="metric-card featured">
          <span>Receita registrada</span>
          <strong>{formatCents(data.metrics.revenueCents)}</strong>
          <small>histórico de serviços</small>
        </article>
        <article className="metric-card">
          <span>Serviços</span>
          <strong>{data.metrics.serviceCount}</strong>
          <small>concluídos</small>
        </article>
        <article className="metric-card">
          <span>Clientes</span>
          <strong>{data.metrics.customerCount}</strong>
          <small>na sua base</small>
        </article>
        <article className="metric-card">
          <span>Oportunidades</span>
          <strong>{data.metrics.opportunities}</strong>
          <small>retornos e inativos</small>
        </article>
        <article className="metric-card">
          <span>Estoque baixo</span>
          <strong>{data.metrics.lowStock}</strong>
          <small>itens para repor</small>
        </article>
      </section>
      <section className="surface">
        <div className="section-title">
          <div>
            <span>Atividade recente</span>
            <h2>Últimos serviços</h2>
          </div>
          <a href="/servicos">Ver todos</a>
        </div>
        {data.services.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>OS</th>
                </tr>
              </thead>
              <tbody>
                {data.services.slice(0, 6).map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.customerName}</strong>
                      <small>
                        {service.vehicleLabel ?? "Sem veículo vinculado"}
                      </small>
                    </td>
                    <td>{service.description}</td>
                    <td>{service.completedAt.toLocaleDateString("pt-BR")}</td>
                    <td>{formatCents(service.amountCents)}</td>
                    <td>
                      <a
                        className="table-link"
                        href={`/servicos/${service.id}`}
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nenhum serviço registrado"
            description="Registre o primeiro atendimento para começar a formar previsões de retorno."
            action="Registrar serviço"
            href="/servicos#novo"
          />
        )}
      </section>
    </AppShell>
  );
}
