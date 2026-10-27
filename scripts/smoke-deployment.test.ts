import { describe, expect, it, vi } from "vitest";
import { runSmoke } from "./smoke-deployment.mjs";

const baseUrl = "https://pilot.example";
const icons = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

function responseFor(path: string) {
  if (path === "/login") {
    return new Response("<h1>Acesso do proprietário</h1><!-- private body -->", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (path === "/manifest.webmanifest") {
    return Response.json({
      name: "Oficina CRM",
      start_url: "/",
      scope: "/",
      display: "standalone",
      icons,
    });
  }
  if (path === "/sw.js") {
    return new Response("self.addEventListener('fetch', () => {})", {
      headers: { "content-type": "application/javascript" },
    });
  }
  if (path === "/logo.jpg") {
    return new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/jpeg" },
    });
  }
  if (path.startsWith("/icons/")) {
    return new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/png" },
    });
  }
  if (path.startsWith("/api/photos/")) {
    return new Response(null, {
      status: 307,
      headers: { location: `${baseUrl}/login` },
    });
  }
  if (path === "/api/cron/whatsapp-reminders") return Response.json({ error: "unauthorized" }, { status: 401 });
  if (path.startsWith("/orcamento/")) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
  if (["/", "/clientes/00000000-0000-4000-8000-000000000000", "/veiculos/00000000-0000-4000-8000-000000000000", "/ordens", "/ordens/00000000-0000-4000-8000-000000000000/imprimir", "/colaboradores", "/financeiro", "/financeiro/receber", "/financeiro/pagar", "/financeiro/caixa", "/financeiro/relatorios", "/retencao", "/estoque", "/configuracoes", "/api/financeiro/business-fin", "/api/veiculos/consultar-placa"].includes(path)) return new Response(null, { status: 307, headers: { location: `${baseUrl}/login` } });
  return new Response("not found", { status: 404 });
}

describe("deployment smoke runner", () => {
  it("checks login, install assets and unauthenticated photo privacy", async () => {
    const paths: string[] = [];
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      paths.push(`${url.pathname}${url.search}`);
      signals.push(init?.signal as AbortSignal);
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).has("cookie")).toBe(false);
      return responseFor(url.pathname);
    });
    const logs: string[] = [];

    await expect(
      runSmoke({
        baseUrl,
        fetchImpl: fetchMock as typeof fetch,
        timeoutMs: 2_000,
        log: (message: string) => logs.push(message),
      }),
    ).resolves.toEqual({ checks: 26, passed: 26 });

    expect(paths).toEqual([
      "/login",
      "/manifest.webmanifest",
      "/sw.js",
      "/logo.jpg",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      expect.stringMatching(/^\/api\/photos\/[0-9a-f-]{36}$/),
      "/",
      "/clientes/00000000-0000-4000-8000-000000000000",
      "/veiculos/00000000-0000-4000-8000-000000000000",
      "/ordens",
      "/ordens/00000000-0000-4000-8000-000000000000/imprimir",
      "/colaboradores",
      "/financeiro?period=current_year&status=expected&recognition=accrual",
      "/financeiro/receber?due=overdue",
      "/financeiro/pagar?status=expected",
      "/financeiro/caixa",
      "/financeiro/relatorios?period=current_month",
      "/api/financeiro/business-fin?from=2026-01-01&to=2026-12-31",
      "/api/veiculos/consultar-placa?plate=ABC1D23",
      "/retencao",
      "/estoque",
      "/configuracoes",
      "/api/cron/whatsapp-reminders",
      expect.stringMatching(/^\/orcamento\/[0-9a-f-]{36}$/),
    ]);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    expect(logs.join("\n")).not.toContain("private body");
    expect(logs.join("\n")).not.toContain("cookie");
  });

  it("rejects non-HTTP base URLs", async () => {
    await expect(runSmoke({ baseUrl: "file:///tmp/app" })).rejects.toThrow(
      "HTTP ou HTTPS",
    );
  });

  it("rejects redirects to another origin", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path === "/login") {
        return new Response(null, {
          status: 307,
          headers: { location: "https://attacker.example/login" },
        });
      }
      return responseFor(path);
    });

    await expect(
      runSmoke({ baseUrl, fetchImpl: fetchMock as typeof fetch }),
    ).rejects.toThrow("fora da origem");
  });
});
