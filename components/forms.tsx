import { adjustInventoryAction, createCustomerAction, createInventoryItemAction, createServiceCatalogAction, createVehicleAction, updateCustomerAction } from "../app/actions";
import type { CustomerSummary, InventorySummary } from "../server/ports";

export function CustomerForm() {
  return <form action={createCustomerAction} className="form-grid">
    <label className="span-2">Nome<input name="name" required minLength={2} placeholder="Nome completo" /></label>
    <label>WhatsApp<input name="phone" inputMode="tel" placeholder="(11) 99999-9999" /></label>
    <label>E-mail<input name="email" type="email" placeholder="cliente@email.com" /></label>
    <label className="check-row span-2"><input name="whatsappConsent" type="checkbox" /> Cliente autorizou contato pelo WhatsApp</label>
    <label className="span-2">Observações<textarea name="notes" rows={3} placeholder="Preferências ou informações importantes" /></label>
    <button className="primary-button" type="submit">Salvar cliente</button>
  </form>;
}

export function CustomerEditForm({ customer }: { customer: CustomerSummary }) {
  return <form action={updateCustomerAction} className="form-grid">
    <input type="hidden" name="customerId" value={customer.id} />
    <label className="span-2">Nome<input name="name" required minLength={2} defaultValue={customer.name} /></label>
    <label>WhatsApp<input name="phone" inputMode="tel" defaultValue={customer.phone ?? ""} placeholder="(11) 99999-9999" /></label>
    <label>E-mail<input name="email" type="email" defaultValue={customer.email ?? ""} placeholder="cliente@email.com" /></label>
    <label className="check-row span-2"><input name="whatsappConsent" type="checkbox" defaultChecked={customer.whatsappConsent} /> Cliente autorizou contato pelo WhatsApp</label>
    <label className="span-2">Observações<textarea name="notes" rows={4} defaultValue={customer.notes ?? ""} placeholder="Preferências ou informações importantes" /></label>
    <div className="form-actions span-2"><button className="primary-button" type="submit">Salvar alterações</button><a className="secondary-button" href="/clientes">Cancelar</a></div>
  </form>;
}

export function VehicleForm({ customers }: { customers: CustomerSummary[] }) {
  return <form action={createVehicleAction} className="form-grid">
    <label className="span-2">Cliente<select name="customerId" required defaultValue=""><option value="" disabled>Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
    <label>Placa<input name="plate" required placeholder="ABC1D23" /></label>
    <label>Marca<input name="make" required placeholder="Honda" /></label>
    <label>Modelo<input name="model" required placeholder="CG 160" /></label>
    <label>Ano<input name="year" type="number" min="1900" max="2100" /></label>
    <label>Quilometragem<input name="odometer" type="number" min="0" /></label>
    <button className="primary-button" type="submit">Adicionar veículo</button>
  </form>;
}

export function ServiceCatalogForm() {
  return <form action={createServiceCatalogAction} className="form-grid compact-form">
    <label className="span-2">Nome do serviço<input name="name" required minLength={2} placeholder="Ex.: Troca de óleo" /></label>
    <label>Preço padrão (R$)<input name="defaultPrice" required inputMode="decimal" placeholder="180,00" /></label>
    <label>Retorno sugerido em dias<input name="defaultReturnIntervalDays" type="number" min="1" placeholder="180" /></label>
    <button className="primary-button" type="submit">Cadastrar serviço</button>
  </form>;
}

export function InventoryItemForm() {
  return <form action={createInventoryItemAction} className="form-grid">
    <label>SKU<input name="sku" placeholder="OLEO-10W30" /></label>
    <label>Nome<input name="name" required placeholder="Óleo 10W30" /></label>
    <label>Unidade<input name="unit" required defaultValue="un" /></label>
    <label>Custo (R$)<input name="cost" required inputMode="decimal" defaultValue="0,00" /></label>
    <label>Venda (R$)<input name="salePrice" required inputMode="decimal" defaultValue="0,00" /></label>
    <label>Quantidade atual<input name="currentQuantity" type="number" min="0" required defaultValue="0" /></label>
    <label>Estoque mínimo<input name="minimumQuantity" type="number" min="0" required defaultValue="0" /></label>
    <button className="primary-button" type="submit">Adicionar item</button>
  </form>;
}

export function InventoryAdjustmentForm({ item }: { item: InventorySummary }) {
  return <form action={adjustInventoryAction} className="inline-form">
    <input type="hidden" name="inventoryItemId" value={item.id} />
    <input aria-label={`Movimentação de ${item.name}`} name="delta" type="number" required placeholder="+10 ou -2" />
    <input aria-label="Motivo" name="note" placeholder="Motivo" />
    <button className="secondary-button" type="submit">Movimentar</button>
  </form>;
}
