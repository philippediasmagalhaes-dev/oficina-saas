export type DamageMarkInput = {
  vehicleView: string;
  xBasisPoints: number;
  yBasisPoints: number;
  damageType: string;
  note: string | null;
};

export type InspectionInput = {
  odometer: number | null;
  fuelLevel: string | null;
  tireCondition: string | null;
  checklist: Record<string, boolean>;
  observations: string | null;
  marks: DamageMarkInput[];
};

export function normalizeInspection(input: InspectionInput): InspectionInput {
  if (input.odometer !== null && (!Number.isInteger(input.odometer) || input.odometer < 0))
    throw new Error("Quilometragem inválida.");
  for (const mark of input.marks) {
    if (![mark.xBasisPoints, mark.yBasisPoints].every((value) => Number.isInteger(value) && value >= 0 && value <= 10000))
      throw new Error("Posição de avaria inválida.");
  }
  return {
    ...input,
    checklist: Object.fromEntries(Object.entries(input.checklist).map(([key, value]) => [key, Boolean(value)])),
    marks: input.marks.map((mark) => ({ ...mark })),
  };
}
