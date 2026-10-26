import { describe, expect, it } from "vitest";
import { config, getCanonicalRedirectUrl, isPublicRoute } from "../proxy";

describe("endereço oficial do piloto", () => {
  it("leva a URL antiga da Vercel para a Cloudflare preservando caminho e busca", () => {
    expect(
      getCanonicalRedirectUrl(
        new URL(
          "https://oficina-saas-green.vercel.app/veiculos?cliente=philippe",
        ),
      )?.toString(),
    ).toBe(
      "https://oficina-saas.contato-ad4.workers.dev/veiculos?cliente=philippe",
    );
  });

  it("não redireciona o endereço oficial da Cloudflare", () => {
    expect(
      getCanonicalRedirectUrl(
        new URL("https://oficina-saas.contato-ad4.workers.dev/veiculos"),
      ),
    ).toBeNull();
  });
});

describe("rotas públicas do PWA", () => {
  it.each([
    "/vehicle-inspection-reference.png",
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/api/cron/whatsapp-reminders",
    "/api/webhooks/whatsapp",
  ])("mantém %s acessível sem sessão", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it("mantém os arquivos do PWA fora do matcher de autenticação", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/manifest.webmanifest")).toBe(false);
    expect(matcher.test("/sw.js")).toBe(false);
    expect(matcher.test("/icons/icon-192.png")).toBe(false);
    expect(matcher.test("/clientes")).toBe(true);
  });
});
