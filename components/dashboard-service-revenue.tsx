import type { CSSProperties } from "react";
import type { ServiceRevenueSummary } from "../domain/dashboard-service-revenue";
import { formatCents } from "../domain/money";

function formatShare(basisPoints: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    basisPoints / 100,
  );
}

export function DashboardServiceRevenue({
  items,
  periodLabel,
}: {
  items: ServiceRevenueSummary[];
  periodLabel: string;
}) {
  const visibleItems = items.slice(0, 8);
  const maxRevenueCents = Math.max(
    ...visibleItems.map((item) => item.revenueCents),
    1,
  );
  const totalRevenueCents = items.reduce(
    (total, item) => total + item.revenueCents,
    0,
  );

  return (
    <section className="surface service-revenue-card">
      <div className="section-title service-revenue-heading">
        <div>
          <span>DESEMPENHO · {periodLabel}</span>
          <h2>Receita por serviço</h2>
          <p>Mão de obra realizada no mês, sem incluir peças.</p>
        </div>
        {items.length ? (
          <div className="service-revenue-total">
            <small>Receita de serviços</small>
            <strong>{formatCents(totalRevenueCents)}</strong>
          </div>
        ) : null}
      </div>

      {visibleItems.length ? (
        <div className="service-revenue-list">
          {visibleItems.map((item, index) => {
            const width = Math.max(
              (item.revenueCents / maxRevenueCents) * 100,
              item.revenueCents ? 3 : 0,
            );
            return (
              <div className="service-revenue-row" key={item.name}>
                <span className="service-revenue-rank">{index + 1}</span>
                <div className="service-revenue-name">
                  <strong>{item.name}</strong>
                  <small>
                    {item.serviceCount} {item.serviceCount === 1 ? "realização" : "realizações"}
                  </small>
                  <span className="service-revenue-track" aria-hidden="true">
                    <i
                      style={
                        { "--service-revenue-width": `${width}%` } as CSSProperties
                      }
                    />
                  </span>
                </div>
                <div className="service-revenue-value">
                  <strong>{formatCents(item.revenueCents)}</strong>
                  <small>{formatShare(item.shareBasisPoints)}% da receita</small>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-clear">
          Nenhum serviço concluído em {periodLabel}.
        </p>
      )}
    </section>
  );
}
