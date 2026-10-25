import { buildPageHref } from "../domain/pagination";

export function PaginationNav({
  pathname,
  query,
  page,
  pageCount,
  previousPage,
  nextPage,
  extra,
}: {
  pathname: string;
  query: string;
  page: number;
  pageCount: number;
  previousPage: number | null;
  nextPage: number | null;
  extra?: Record<string, string | null | undefined>;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination-nav" aria-label="Paginação">
      {previousPage ? (
        <a
          className="secondary-button"
          href={buildPageHref(pathname, { q: query, page: previousPage, extra })}
        >
          ← Anterior
        </a>
      ) : (
        <span />
      )}
      <small>
        Página {page} de {pageCount}
      </small>
      {nextPage ? (
        <a
          className="secondary-button"
          href={buildPageHref(pathname, { q: query, page: nextPage, extra })}
        >
          Próxima →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}

