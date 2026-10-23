import { describe, expect, it } from "vitest";
import { config, isPublicRoute } from "../proxy";

describe("rotas públicas do PWA", () => {
  it.each([
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
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
