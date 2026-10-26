import {
  createFinancialCategoryAction,
  deactivateFinancialCategoryAction,
  updateFinancialCategoryAction,
} from "../app/actions";

type Category = {
  id: string;
  key: string;
  name: string;
  direction: "income" | "expense" | "reserve";
  protected: boolean;
  active: boolean;
};

const directionLabels = { income: "Receita", expense: "Despesa", reserve: "Reserva" } as const;

export function FinancialCategoryManager({ categories }: { categories: Category[] }) {
  return (
    <section className="surface">
      <div className="section-title"><div><span>Plano de categorias</span><h2>Categorias financeiras</h2></div></div>
      <p className="field-hint">As categorias do sistema mantêm as automações. Você pode renomeá-las; categorias próprias também podem mudar de tipo ou ser desativadas.</p>
      <div className="financial-category-list">
        {categories.map((category) => (
          <div key={category.id} className={!category.active ? "inactive" : ""}>
            <form action={updateFinancialCategoryAction}>
              <input type="hidden" name="categoryId" value={category.id} />
              <input name="name" defaultValue={category.name} required />
              {category.protected ? (
                <><input type="hidden" name="direction" value={category.direction} /><span>{directionLabels[category.direction]} · sistema</span></>
              ) : (
                <select name="direction" defaultValue={category.direction}>
                  {Object.entries(directionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              )}
              <button className="text-button" type="submit">Salvar</button>
            </form>
            {!category.protected && category.active ? (
              <form action={deactivateFinancialCategoryAction}>
                <input type="hidden" name="categoryId" value={category.id} />
                <button className="text-button danger-text" type="submit">Desativar</button>
              </form>
            ) : <small>{category.active ? "Protegida" : "Inativa"}</small>}
          </div>
        ))}
      </div>
      <form action={createFinancialCategoryAction} className="form-grid compact-form category-create-form">
        <label>Nova categoria<input name="name" required placeholder="Ex.: guincho terceirizado" /></label>
        <label>Tipo<select name="direction" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option><option value="reserve">Reserva</option></select></label>
        <button className="secondary-button" type="submit">Criar categoria</button>
      </form>
    </section>
  );
}

