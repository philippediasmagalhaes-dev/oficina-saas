const items = [
  ["Visão geral", "/financeiro"],
  ["Contas a receber", "/financeiro/receber"],
  ["Contas a pagar", "/financeiro/pagar"],
  ["Caixa", "/financeiro/caixa"],
  ["Relatórios", "/financeiro/relatorios"],
] as const;

export function FinanceNav({ current }: { current: string }) {
  return <nav className="finance-nav" aria-label="Áreas do financeiro">
    {items.map(([label, href]) => <a key={href} href={href} className={current === href ? "active" : ""}>{label}</a>)}
  </nav>;
}
