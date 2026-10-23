import { saveFinancialSettingsAction, savePaymentFeeRuleAction } from "../app/actions";
import { formatCents } from "../domain/money";

const paymentLabels: Record<string, string> = { pix: "PIX", cash: "Dinheiro", debit_card: "Cartão de débito", credit_card: "Cartão de crédito", transfer: "Transferência", other: "Outro" };

export function FinancialSettingsForm({ settings, feeRules }: { settings: { defaultTaxBasisPoints: number; defaultRecognitionMode: string }; feeRules: Array<{ id: string; paymentMethod: string; installmentCount: number; percentageBasisPoints: number; fixedFeeCents: number }> }) {
  return <div className="split-grid settings-financial-grid">
    <section className="surface"><div className="section-title"><div><span>Impostos e relatórios</span><h2>Padrões financeiros</h2></div></div><form action={saveFinancialSettingsAction} className="form-grid compact-form">
      <label>Reserva de imposto (%)<input name="defaultTaxPercent" type="number" min="0" max="100" step="0.01" defaultValue={settings.defaultTaxBasisPoints / 100} /></label>
      <label>Regime padrão<select name="defaultRecognitionMode" defaultValue={settings.defaultRecognitionMode}><option value="cash">Caixa (quando recebe)</option><option value="accrual">Competência (quando realiza)</option></select></label>
      <button className="primary-button span-2" type="submit">Salvar padrões</button>
    </form></section>
    <section className="surface"><div className="section-title"><div><span>Taxas da maquininha</span><h2>Regra por forma e parcelas</h2></div></div><form action={savePaymentFeeRuleAction} className="form-grid compact-form">
      <label>Forma<select name="paymentMethod" defaultValue="credit_card">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Parcelas<input name="installmentCount" type="number" min="1" max="24" defaultValue="1" /></label>
      <label>Taxa (%)<input name="percentage" type="number" min="0" max="100" step="0.01" defaultValue="0" /></label>
      <label>Tarifa fixa<input name="fixedFee" inputMode="decimal" defaultValue="0,00" /></label>
      <button className="secondary-button span-2" type="submit">Adicionar regra</button>
    </form>{feeRules.length ? <div className="settings-rule-list">{feeRules.map((rule) => <div key={rule.id}><span>{paymentLabels[rule.paymentMethod] ?? rule.paymentMethod} · {rule.installmentCount}x</span><strong>{(rule.percentageBasisPoints / 100).toLocaleString("pt-BR")}% + {formatCents(rule.fixedFeeCents)}</strong></div>)}</div> : <p className="muted">Sem taxas cadastradas. PIX e dinheiro ficam sem desconto.</p>}</section>
  </div>;
}
