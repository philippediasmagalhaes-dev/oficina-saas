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
  return new Response("not found", { status: 404 });
}

describe("deployment smoke runner", () => {
  it("checks login, install assets and unauthenticated photo privacy", async () => {
    const paths: string[] = [];
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
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
    ).resolves.toEqual({ checks: 8, passed: 8 });

    expect(paths).toEqual([
      "/login",
      "/manifest.webmanifest",
      "/sw.js",
      "/logo.jpg",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      expect.stringMatching(/^\/api\/photos\/[0-9a-f-]{36}$/),
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
