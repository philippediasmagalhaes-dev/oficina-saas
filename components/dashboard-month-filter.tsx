export function DashboardMonthFilter({ value }: { value: string }) {
  return <form method="get" className="dashboard-month-filter">
    <label>Mês do painel<input type="month" name="mes" defaultValue={value} /></label>
    <button className="secondary-button" type="submit">Aplicar</button>
  </form>;
}
