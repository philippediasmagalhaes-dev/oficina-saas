import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadyWhatsAppAction } from "./ready-whatsapp-action";

describe("ReadyWhatsAppAction", () => {
  it("renders one clear WhatsApp action in a new tab", () => {
    const html = renderToStaticMarkup(
      <ReadyWhatsAppAction serviceId="order-1" action="/test-action" />,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Abrir WhatsApp do cliente");
  });
});
