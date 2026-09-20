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
        <a className="primary-button" href="/ordens#nova">
          Abrir ordem de serviço
        </a>
      </div>
      <section className="metric-grid">
        <article className="metric-card featured">
          <span>Receita no mês</span>
          <strong>{formatCents(data.metrics.revenueCents)}</strong>
          <small>serviços realizados no mês atual</small>
        </article>
        <article className="metric-card">
          <span>Serviços</span>
          <strong>{data.metrics.serviceCount}</strong>
          <small>concluídos neste mês</small>
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
            <span>Mês atual</span>
            <h2>Serviços realizados neste mês</h2>
          </div>
          <a href="/ordens">Ver todas</a>
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
                        href={`/ordens/${service.id}`}
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
            title="Nenhum serviço neste mês"
            description="Os atendimentos do mês atual aparecerão aqui assim que forem registrados."
            action="Abrir ordem de serviço"
            href="/ordens#nova"
          />
        )}
      </section>
    </AppShell>
  );
}
