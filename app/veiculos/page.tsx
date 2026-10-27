import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/empty-state";
import { VehicleForm } from "../../components/forms";
import { PaginationNav } from "../../components/pagination-nav";
import { readServerConfig } from "../../db/config";
import { normalizePageRequest } from "../../domain/pagination";
import { getVehiclesData } from "../../server/queries";
import { ConfigurationPending } from "../configurar/page";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; nova?: string }>;
}) {
  const config = readServerConfig(process.env);
  if (!config.configured)
    return <ConfigurationPending missing={config.missing} />;
  const { q = "", page, nova } = await searchParams;
  const showForm = nova === "1";
  const data = await getVehiclesData({
    query: q,
    ...normalizePageRequest({ page }),
    includeFormOptions: showForm,
  });
  const vehicles = data.vehicles;

  return (
    <AppShell workshopName={data.workshop.name} current="/veiculos">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VEÍCULOS</p>
          <h1>Veículos</h1>
          <p>Consulte proprietário, quilometragem, serviços e próximas manutenções.</p>
        </div>
        <a className="primary-button" href="/veiculos?nova=1#novo">
          Cadastrar veículo
        </a>
      </div>
      <section className="surface filter-surface">
        <form className="vehicle-search" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por placa, modelo ou cliente"
          />
          <button className="secondary-button" type="submit">
            Buscar
          </button>
          {q ? (
            <a className="secondary-button" href="/veiculos">
              Limpar
            </a>
          ) : null}
        </form>
      </section>
      <section className="surface compact-list-surface">
        <div className="section-title">
          <div>
            <span>{vehicles.total} encontrados</span>
            <h2>Veículos da oficina</h2>
          </div>
        </div>
        {vehicles.items.length ? (
          <div className="vehicle-grid compact-vehicle-grid">
            {vehicles.items.map((vehicle) => (
              <a className="vehicle-card" href={`/veiculos/${vehicle.id}`} key={vehicle.id}>
                <span>{vehicle.plate}</span>
                <h3>
                  {vehicle.make} {vehicle.model}
                </h3>
                <p>{vehicle.customerName}</p>
                <div>
                  <small>{vehicle.year ?? "Ano não informado"}</small>
                  <small>
                    {vehicle.serviceCount} {vehicle.serviceCount === 1 ? "OS" : "OSs"}
                  </small>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum veículo encontrado"
            description="Cadastre um veículo ou ajuste a busca."
          />
        )}
        <PaginationNav
          pathname="/veiculos"
          query={q}
          page={vehicles.page}
          pageCount={vehicles.pageCount}
          previousPage={vehicles.previousPage}
          nextPage={vehicles.nextPage}
        />
      </section>
      {showForm ? (
        <section className="surface" id="novo">
          <div className="section-title">
            <div>
              <span>Novo cadastro</span>
              <h2>Adicionar veículo</h2>
            </div>
          </div>
          {data.customers.length ? (
            <VehicleForm customers={data.customers} />
          ) : (
            <EmptyState
              title="Cadastre um cliente primeiro"
              description="Todo veículo precisa ter um proprietário."
              action="Ir para clientes"
              href="/clientes#novo"
            />
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
