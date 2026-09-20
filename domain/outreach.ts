type OutreachInput = {
  phone: string | null;
  consent: boolean;
  customer: string;
  workshop: string;
  reason?: string;
};

type ServiceReadyInput = Omit<OutreachInput, "reason"> & {
  vehicle?: string | null;
};

export type WhatsAppDraft = { message: string; url: string };

export function normalizeBrazilianPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `55${digits}`;
}

export function buildWhatsAppDraft(input: OutreachInput): WhatsAppDraft | null {
  if (!input.consent || !input.phone) return null;
  const phone = normalizeBrazilianPhone(input.phone);
  if (!phone) return null;

  const reason = input.reason ? ` sobre ${input.reason}` : "";
  const message = `Olá, ${input.customer}! Aqui é da ${input.workshop}. Passando para saber como está seu veículo${reason}. Podemos ajudar com uma revisão?`;
  return {
    message,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}

export function buildServiceReadyDraft(
  input: ServiceReadyInput,
): WhatsAppDraft | null {
  if (!input.consent || !input.phone) return null;
  const phone = normalizeBrazilianPhone(input.phone);
  if (!phone) return null;

  const vehicle = input.vehicle ? ` ${input.vehicle}` : "";
  const message = `Olá, ${input.customer}! Aqui é da ${input.workshop}. Seu veículo${vehicle} está pronto e já pode ser retirado. Se precisar, responda esta mensagem para combinarmos a entrega.`;
  return {
    message,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}
