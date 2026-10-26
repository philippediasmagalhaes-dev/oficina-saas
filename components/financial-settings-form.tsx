"use client";

import {
  deactivatePaymentFeeRuleAction,
  saveFinancialSettingsAction,
  savePaymentFeeRuleAction,
} from "../app/actions";
import { MoneyInput } from "./money-input";

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  transfer: "Transferência",
  other: "Outro",
};

function money(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function FinancialSettingsForm({
  settings,
  feeRules,
}: {
  settings: { defaultTaxBasisPoints: number; defaultRecognitionMode: string };
  feeRules: Array<{
    id: string;
    paymentMethod: string;
    installmentCount: number;
    percentageBasisPoints: number;
    fixedFeeCents: number;
  }>;
}) {
  return (
    <div className="split-grid settings-financial-grid">
      <section className="surface">
        <div className="section-title"><div><span>Impostos e relatórios</span><h2>Padrões financeiros</h2></div></div>
        <form action={saveFinancialSettingsAction} className="form-grid compact-form">
          <label>Reserva de imposto (%)<input name="defaultTaxPercent" type="number" min="0" max="100" step="0.01" defaultValue={settings.defaultTaxBasisPoints / 100} onFocus={(event) => event.currentTarget.select()} /></label>
          <label>Regime padrão<select name="defaultRecognitionMode" defaultValue={settings.defaultRecognitionMode}><option value="cash">Caixa (quando recebe)</option><option value="accrual">Competência (quando realiza)</option></select></label>
          <button className="primary-button span-2" type="submit">Salvar padrões</button>
        </form>
      </section>
      <section className="surface">
        <div className="section-title"><div><span>Taxas da maquininha</span><h2>Regra por forma e parcelas</h2></div></div>
        <p className="field-hint">Cadastre uma regra para cada quantidade de parcelas. Ex.: crédito 1x, 2x, 3x e assim por diante.</p>
        <form action={savePaymentFeeRuleAction} className="form-grid compact-form">
          <label>Forma<select name="paymentMethod" defaultValue="credit_card">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Parcelas<input name="installmentCount" type="number" min="1" max="24" defaultValue="1" onFocus={(event) => event.currentTarget.select()} /></label>
          <label>Taxa (%)<input name="percentage" type="number" min="0" max="100" step="0.01" defaultValue="0" onFocus={(event) => event.currentTarget.select()} /></label>
          <label>Tarifa fixa<MoneyInput name="fixedFee" defaultValue="0,00" /></label>
          <button className="secondary-button span-2" type="submit">Adicionar ou substituir regra</button>
        </form>
        {feeRules.length ? (
          <div className="settings-rule-list editable-fee-rules">
            {feeRules.map((rule) => (
              <div key={rule.id}>
                <form action={savePaymentFeeRuleAction} className="fee-rule-edit">
                  <input type="hidden" name="paymentMethod" value={rule.paymentMethod} />
                  <input type="hidden" name="installmentCount" value={rule.installmentCount} />
                  <strong>{paymentLabels[rule.paymentMethod] ?? rule.paymentMethod} · {rule.installmentCount}x</strong>
                  <label>Taxa %<input name="percentage" type="number" min="0" max="100" step="0.01" defaultValue={rule.percentageBasisPoints / 100} onFocus={(event) => event.currentTarget.select()} /></label>
                  <label>Fixa<MoneyInput name="fixedFee" defaultValue={money(rule.fixedFeeCents)} /></label>
                  <button className="text-button" type="submit">Salvar</button>
                </form>
                <form action={deactivatePaymentFeeRuleAction}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <button className="text-button danger-text" type="submit">Excluir</button>
                </form>
              </div>
            ))}
          </div>
        ) : <p className="muted">Sem taxas cadastradas. PIX e dinheiro ficam sem desconto.</p>}
      </section>
    </div>
  );
}

