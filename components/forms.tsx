import { adjustInventoryAction, createCustomerAction, createInventoryItemAction, createServiceCatalogAction, updateCustomerAction } from "../app/actions";
import type { CustomerSummary, InventorySummary, VehicleSummary } from "../server/ports";
import { PlateLookupForm } from "./plate-lookup-form";
import { MoneyInput } from "./money-input";

export function CustomerForm() {
  return <form action={createCustomerAction} className="form-grid">
    <label className="span-2">Nome<input name="name" required minLength={2} placeholder="Nome completo" /></label>
    <label>WhatsApp<input name="phone" inputMode="tel" placeholder="(11) 99999-9999" /></label>
    <label>E-mail<input name="email" type="email" placeholder="cliente@email.com" /></label>
    <label>CPF/CNPJ<input name="document" placeholder="Documento opcional" /></label>
    <label>CEP<input name="addressPostalCode" placeholder="00000-000" /></label>
    <label className="span-2">Endereço<input name="addressStreet" placeholder="Rua ou avenida" /></label>
    <label>Número<input name="addressNumber" /></label><label>Complemento<input name="addressComplement" /></label>
    <label>Bairro<input name="addressDistrict" /></label><label>Cidade<input name="addressCity" /></label>
    <label>UF<input name="addressState" maxLength={2} placeholder="SP" /></label>
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
    <label>CPF/CNPJ<input name="document" defaultValue={customer.document ?? ""} /></label>
    <label>CEP<input name="addressPostalCode" defaultValue={customer.addressPostalCode ?? ""} /></label>
    <label className="span-2">Endereço<input name="addressStreet" defaultValue={customer.addressStreet ?? ""} /></label>
    <label>Número<input name="addressNumber" defaultValue={customer.addressNumber ?? ""} /></label><label>Complemento<input name="addressComplement" defaultValue={customer.addressComplement ?? ""} /></label>
    <label>Bairro<input name="addressDistrict" defaultValue={customer.addressDistrict ?? ""} /></label><label>Cidade<input name="addressCity" defaultValue={customer.addressCity ?? ""} /></label>
    <label>UF<input name="addressState" maxLength={2} defaultValue={customer.addressState ?? ""} /></label>
    <label className="check-row span-2"><input name="whatsappConsent" type="checkbox" defaultChecked={customer.whatsappConsent} /> Cliente autorizou contato pelo WhatsApp</label>
    <label className="span-2">Observações<textarea name="notes" rows={4} defaultValue={customer.notes ?? ""} placeholder="Preferências ou informações importantes" /></label>
    <div className="form-actions span-2"><button className="primary-button" type="submit">Salvar alterações</button><a className="secondary-button" href="/clientes">Cancelar</a></div>
  </form>;
}

export function VehicleForm({ customers }: { customers: CustomerSummary[] }) {
  return <PlateLookupForm customers={customers} />;
}

export function VehicleEditForm({ vehicle, customers }: { vehicle: VehicleSummary; customers: CustomerSummary[] }) {
  return <PlateLookupForm customers={customers} vehicle={vehicle} />;
}

export function ServiceCatalogForm() {
  return <form action={createServiceCatalogAction} className="form-grid compact-form">
    <label className="span-2">Nome do serviço<input name="name" required minLength={2} placeholder="Ex.: Troca de óleo" /></label>
    <label>Preço padrão (R$)<MoneyInput name="defaultPrice" required defaultValue="0,00" /></label>
    <label>Retorno sugerido em dias<input name="defaultReturnIntervalDays" type="number" min="1" placeholder="180" /></label>
    <label>Retorno sugerido em km<input name="defaultReturnIntervalKm" type="number" min="1" placeholder="5000" /></label>
    <button className="primary-button" type="submit">Cadastrar serviço</button>
  </form>;
}

export function InventoryItemForm() {
  return <form action={createInventoryItemAction} className="form-grid">
    <label>SKU<input name="sku" placeholder="OLEO-10W30" /></label>
    <label>Nome<input name="name" required placeholder="Óleo 10W30" /></label>
    <label>Unidade<input name="unit" required defaultValue="un" /></label>
    <label>Custo (R$)<MoneyInput name="cost" required defaultValue="0,00" /></label>
    <label>Venda (R$)<MoneyInput name="salePrice" required defaultValue="0,00" /></label>
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
