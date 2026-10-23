import { calculateAssignmentCompensation, type CompensationMode } from "./commissions";

export type ClosingPaymentInput = {
  id: string;
  method: string;
  amountCents: number;
  installmentCount: number;
  percentageBasisPoints: number;
  fixedFeeCents: number;
  manualFeeCents: number | null;
};

export type ClosingAssignmentInput = {
  id: string;
  collaboratorId: string;
  mode: CompensationMode;
  participationBasisPoints: number;
  commissionBasisPoints: number;
  fixedPerServiceCents: number;
};

export type FinancialClosingInput = {
  orderTotalCents: number;
  taxBasisPoints: number;
  payments: ClosingPaymentInput[];
  laborItems: Array<{ id: string; grossCents: number; discountCents: number; assignments: ClosingAssignmentInput[] }>;
};

export type FinancialClosing = {
  orderTotalCents: number;
  feeTotalCents: number;
  taxReserveCents: number;
  compensationTotalCents: number;
  netTotalCents: number;
  payments: Array<ClosingPaymentInput & { feeAmountCents: number; netAmountCents: number }>;
  assignments: Array<ClosingAssignmentInput & { laborItemId: string; laborBaseCents: number; compensationCents: number }>;
};

function validInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function calculatePaymentFee(payment: ClosingPaymentInput) {
  if (!validInteger(payment.amountCents) || payment.amountCents === 0) throw new Error("Pagamento inválido.");
  if (!Number.isInteger(payment.installmentCount) || payment.installmentCount < 1) throw new Error("Parcelamento inválido.");
  if (!validInteger(payment.percentageBasisPoints) || payment.percentageBasisPoints > 10_000 || !validInteger(payment.fixedFeeCents)) throw new Error("Regra de taxa inválida.");
  if (payment.manualFeeCents !== null && !validInteger(payment.manualFeeCents)) throw new Error("Taxa manual inválida.");
  const feeAmountCents = payment.manualFeeCents ?? Math.round(payment.amountCents * payment.percentageBasisPoints / 10_000) + payment.fixedFeeCents;
  if (feeAmountCents > payment.amountCents) throw new Error("A taxa não pode superar o pagamento.");
  return { ...payment, feeAmountCents, netAmountCents: payment.amountCents - feeAmountCents };
}

export function calculateFinancialClosing(input: FinancialClosingInput): FinancialClosing {
  if (!validInteger(input.orderTotalCents) || input.orderTotalCents === 0) throw new Error("Total da ordem inválido.");
  if (!validInteger(input.taxBasisPoints) || input.taxBasisPoints > 10_000) throw new Error("Percentual de imposto inválido.");
  if (input.payments.reduce((sum, payment) => sum + payment.amountCents, 0) !== input.orderTotalCents) throw new Error("A soma dos pagamentos deve ser igual ao total da ordem.");

  const payments = input.payments.map(calculatePaymentFee);
  const assignments = input.laborItems.flatMap((item) => {
    if (!validInteger(item.grossCents) || !validInteger(item.discountCents) || item.discountCents > item.grossCents) throw new Error("Mão de obra inválida.");
    const discountedLaborCents = item.grossCents - item.discountCents;
    return item.assignments.map((assignment) => {
      const compensation = calculateAssignmentCompensation({ ...assignment, discountedLaborCents });
      return { ...assignment, laborItemId: item.id, laborBaseCents: compensation.laborBaseCents, compensationCents: compensation.totalCents };
    });
  });
  const feeTotalCents = payments.reduce((sum, payment) => sum + payment.feeAmountCents, 0);
  const taxReserveCents = Math.round(input.orderTotalCents * input.taxBasisPoints / 10_000);
  const compensationTotalCents = assignments.reduce((sum, assignment) => sum + assignment.compensationCents, 0);
  return { orderTotalCents: input.orderTotalCents, feeTotalCents, taxReserveCents, compensationTotalCents, netTotalCents: input.orderTotalCents - feeTotalCents - taxReserveCents - compensationTotalCents, payments, assignments };
}
