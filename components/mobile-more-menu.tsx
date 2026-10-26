import type { NavigationItem } from "./app-shell";

function isActive(current: string, href: string) {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

export function MobileMoreMenu({ items, current }: { items: NavigationItem[]; current: string }) {
  const hasActiveItem = items.some((item) => isActive(current, item.href));
  return (
    <details className={hasActiveItem ? "mobile-more active" : "mobile-more"}>
      <summary><i aria-hidden="true">•••</i><span>Mais</span></summary>
      <div className="mobile-more-popover" aria-label="Mais áreas">
        <div><strong>Outras áreas</strong><small>Gestão e relacionamento</small></div>
        {items.map((item) => <a key={item.href} href={item.href} className={isActive(current, item.href) ? "active" : ""}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></a>)}
      </div>
    </details>
  );
}
