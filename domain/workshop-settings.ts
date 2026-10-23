export function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeBrazilianPhone(value: string | null | undefined) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function normalizeBrazilianDocument(value: string | null | undefined) {
  return digitsOnly(value);
}

export function normalizePlate(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatWorkOrderNumber(value: number) {
  return `OS Nº ${value}`;
}
