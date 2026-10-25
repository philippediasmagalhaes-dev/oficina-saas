import type { ComponentProps } from "react";

export function ReadyWhatsAppAction({
  serviceId,
  action,
}: {
  serviceId: string;
  action: NonNullable<ComponentProps<"form">["action"]>;
}) {
  return (
    <form action={action} target="_blank">
      <input type="hidden" name="serviceId" value={serviceId} />
      <button className="primary-button" type="submit">
        Abrir WhatsApp do cliente
      </button>
    </form>
  );
}

