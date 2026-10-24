export type ImportedOrderStatus =
  | "completed"
  | "open"
  | "diagnosis"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export const APPROVED_SHOFICINA_BACKUP_HASH =
  "94F70458B0011C3FB514FFFA860B21E581869557289C67982CF13C501408C6F1";
export const LEGACY_IMPORT_LEASE_MS = 30 * 60 * 1000;

export function assertLegacySourceHash(sourceHash: string): void {
  if (sourceHash.toUpperCase() !== APPROVED_SHOFICINA_BACKUP_HASH) {
    throw new Error(
      "O backup não corresponde ao arquivo aprovado para esta migração.",
    );
  }
}

export function assertLegacyImportComplete(summary: {
  skippedServiceItems: number;
  skippedPartItems: number;
  skippedPhotos: number;
}): void {
  if (
    summary.skippedServiceItems > 0 ||
    summary.skippedPartItems > 0 ||
    summary.skippedPhotos > 0
  ) {
    throw new Error("A importação está incompleta e não pode ser confirmada.");
  }
}

export function safeLegacyImportError(_error: unknown): string {
  return "A importação falhou e a transação foi revertida.";
}

export function isLegacyImportLeaseExpired(
  startedAt: Date,
  now = new Date(),
): boolean {
  return now.getTime() - startedAt.getTime() >= LEGACY_IMPORT_LEASE_MS;
}

type LegacyVehicleRow = {
  CODIGO: unknown;
  DESCRICAO?: unknown;
  MARCA?: unknown;
  MODELO?: unknown;
  SERIE?: unknown;
  PAT?: unknown;
};

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text || null;
}

export function normalizeLegacyPhone(value: unknown): string | null {
  const digits = cleanText(value)?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (
    (digits.length === 10 || digits.length === 11) &&
    !digits.startsWith("55")
  )
    return `55${digits}`;
  return digits;
}

export function normalizeLegacyDocument(value: unknown): string | null {
  return cleanText(value)?.replace(/\D/g, "") || null;
}

export function normalizeLegacyPlate(value: unknown): string | null {
  const normalized =
    cleanText(value)
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "") ?? "";
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalized) ? normalized : null;
}

export function reaisToCents(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const normalized =
    typeof value === "string"
      ? value.trim().replace(/\./g, "").replace(",", ".")
      : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round((number + Number.EPSILON) * 100);
}

function normalizeForComparison(value: unknown): string {
  return (
    cleanText(value)
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase() ?? ""
  );
}

export function mapLegacyOrderStatus(
  value: unknown,
  hasExitDate: boolean,
): ImportedOrderStatus {
  const status = normalizeForComparison(value);
  if (!status) return hasExitDate ? "delivered" : "open";
  if (status.includes("condenado")) return "cancelled";
  if (status.includes("entregue")) return "delivered";
  if (status.includes("pronto")) return "ready";
  if (status.includes("aguardando autorizacao")) return "awaiting_approval";
  if (status.includes("aguardando avaliacao")) return "diagnosis";
  if (
    status.includes("autorizado") ||
    status.includes("reparo em andamento") ||
    status.includes("aguardando peca")
  )
    return "in_progress";
  return hasExitDate ? "delivered" : "open";
}

function parseVehicleDescription(value: unknown) {
  const description = cleanText(value) ?? "Veículo não identificado";
  const match = description.match(/(?:\/|\s)(19\d{2}|20\d{2})\s*$/);
  if (!match) return { model: description, year: null };
  return {
    model:
      description
        .slice(0, match.index)
        .trim()
        .replace(/[\s/\-]+$/, "") || description,
    year: Number(match[1]),
  };
}

function maskChassis(value: unknown): string | null {
  const chassis = cleanText(value)?.replace(/\s/g, "") ?? "";
  if (!chassis) return null;
  if (chassis.length <= 5) return chassis;
  return `${"*".repeat(Math.min(12, chassis.length - 5))}${chassis.slice(-5)}`;
}

export function buildLegacyVehicle(
  row: LegacyVehicleRow,
  usedPlates: Set<string>,
) {
  const legacyId = String(row.CODIGO);
  const { model, year } = parseVehicleDescription(row.DESCRICAO);
  const normalized = normalizeLegacyPlate(row.SERIE);
  let plate = normalized ?? `SEMPLACA-${legacyId}`;
  let plateNormalized: string | null = normalized;
  let originalPlate: string | null = null;

  if (normalized && usedPlates.has(normalized)) {
    originalPlate = normalized;
    plate = `${normalized}-LEG${legacyId}`;
    plateNormalized = null;
  }
  usedPlates.add(plate);

  return {
    legacyId,
    plate,
    plateNormalized,
    make: cleanText(row.MARCA) ?? "Não informada",
    model,
    year,
    color: cleanText(row.MODELO),
    maskedChassis: maskChassis(row.PAT),
    originalPlate,
  };
}

export function parseLegacyPhotoName(
  value: string,
): { orderNumber: number; index: number } | null {
  const name = value.replace(/\\/g, "/").split("/").pop() ?? "";
  const match = /^O(\d{6})(\d)\.bmp$/i.exec(name);
  if (!match) return null;
  return { orderNumber: Number(match[1]), index: Number(match[2]) };
}

export function parseLegacyDate(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const text = cleanText(value);
  if (!text) return null;
  const powershell = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(text);
  const date = powershell ? new Date(Number(powershell[1])) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveLegacyOrderDates(
  row: { ENTRADA?: unknown; PRONTO?: unknown; SAIDA?: unknown },
  fallback: Date,
) {
  const intakeAt = parseLegacyDate(row.ENTRADA);
  const readyAt = parseLegacyDate(row.PRONTO);
  const exitAt = parseLegacyDate(row.SAIDA);
  return {
    intakeAt,
    createdAt: intakeAt ?? fallback,
    updatedAt: exitAt ?? readyAt ?? intakeAt ?? fallback,
  };
}

export function buildLegacyOrderDateRepairs(
  orders: Array<{ CODIGO: unknown; ENTRADA?: unknown }>,
  targetByLegacyId: Map<string, string>,
) {
  return orders.flatMap((row) => {
    const targetId = targetByLegacyId.get(String(row.CODIGO));
    return targetId
      ? [{ targetId, intakeAt: parseLegacyDate(row.ENTRADA) }]
      : [];
  });
}

export function resolveLegacyOrderNumber(
  legacyNumber: number,
  occupied: Set<number>,
  suggestedNext: number,
) {
  if (
    Number.isInteger(legacyNumber) &&
    legacyNumber > 0 &&
    !occupied.has(legacyNumber)
  ) {
    occupied.add(legacyNumber);
    return {
      orderNumber: legacyNumber,
      nextOrderNumber: Math.max(suggestedNext, legacyNumber + 1),
      collided: false,
    };
  }

  let orderNumber = Math.max(1, suggestedNext);
  while (occupied.has(orderNumber)) orderNumber += 1;
  occupied.add(orderNumber);
  return { orderNumber, nextOrderNumber: orderNumber + 1, collided: true };
}

export function cleanLegacyText(value: unknown): string | null {
  return cleanText(value);
}
