import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhatsAppLink } from "./whatsapp-link";

describe("WhatsAppLink", () => {
  it("opens the prepared conversation in a separate safe tab", () => {
    const html = renderToStaticMarkup(
      <WhatsAppLink href="https://wa.me/5511999999999?text=Oi">
        Abrir WhatsApp
      </WhatsAppLink>,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('href="https://wa.me/5511999999999?text=Oi"');
  });
});
