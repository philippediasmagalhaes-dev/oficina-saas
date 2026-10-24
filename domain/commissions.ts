export type CompensationMode = "fixed_monthly" | "fixed_per_service" | "percentage" | "hybrid";

export type AssignmentCompensationInput = {
  mode: CompensationMode;
  discountedLaborCents: number;
  participationBasisPoints: number;
  commissionBasisPoints: number;
  fixedPerServiceCents: number;
};

function validMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validBasisPoints(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 10000;
}

export function calculateAssignmentCompensation(input: AssignmentCompensationInput) {
  if (![input.discountedLaborCents, input.fixedPerServiceCents].every(validMoney) || ![input.participationBasisPoints, input.commissionBasisPoints].every(validBasisPoints))
    throw new Error("Configuração de comissão inválida.");
  const laborBaseCents = Math.round(input.discountedLaborCents * input.participationBasisPoints / 10000);
  const usesCommission = input.mode === "percentage" || input.mode === "hybrid";
  const usesFixed = input.mode === "fixed_per_service" || input.mode === "hybrid";
  const commissionNumerator = BigInt(input.discountedLaborCents) * BigInt(input.participationBasisPoints) * BigInt(input.commissionBasisPoints);
  const commissionDenominator = BigInt(100_000_000);
  const commissionCents = usesCommission ? Number((commissionNumerator + commissionDenominator / BigInt(2)) / commissionDenominator) : 0;
  const fixedPerServiceCents = usesFixed ? input.fixedPerServiceCents : 0;
  return { laborBaseCents, commissionCents, fixedPerServiceCents, totalCents: commissionCents + fixedPerServiceCents };
}

export function hasMonthlyCompensation(mode: CompensationMode) {
  return mode === "fixed_monthly" || mode === "hybrid";
}

export function validateParticipationTotal(values: number[]) {
  if (!values.every(validBasisPoints)) throw new Error("Participação inválida.");
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total > 10000) throw new Error("Participação total não pode ultrapassar 100%.");
  return total;
}
