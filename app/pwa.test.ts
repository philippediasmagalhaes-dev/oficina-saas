import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const publicUrl = new URL("../public/", import.meta.url);

function readPngDimensions(path: string) {
  const bytes = readFileSync(new URL(path, publicUrl));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("installable privacy-safe PWA", () => {
  it("publishes the expected workshop manifest", () => {
    expect(manifest()).toMatchObject({
      name: "Oficina CRM",
      short_name: "Oficina",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#050505",
      background_color: "#050505",
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    });
  });

  it("links the manifest and registers the worker once from the root layout", () => {
    const layout = readFileSync(new URL("layout.tsx", import.meta.url), "utf8");
    const registration = readFileSync(
      new URL("../components/service-worker-registration.tsx", import.meta.url),
      "utf8",
    );

    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toContain("<ServiceWorkerRegistration />");
    expect(registration).toContain('serviceWorker.register("/sw.js"');
  });

  it("pre-caches only the exact public image allow-list", () => {
    const worker = readFileSync(new URL("sw.js", publicUrl), "utf8");
    const allowListSource = worker.match(
      /const IMMUTABLE_ASSETS = (\[[\s\S]*?\]);/,
    )?.[1];

    expect(allowListSource).toBeDefined();
    expect(JSON.parse(allowListSource!)).toEqual([
      "/logo.jpg",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
    ]);
    expect(worker).not.toContain('"/"');
    expect(worker).not.toContain("request.mode === \"navigate\"");
    expect(worker).not.toContain("/api");
    expect(worker).not.toContain("text/html");
    expect(worker).not.toMatch(/method\s*===?\s*["']GET["']/);
  });

  it("commits correctly sized PNG icons", () => {
    expect(readPngDimensions("icons/icon-192.png")).toEqual({
      width: 192,
      height: 192,
    });
    expect(readPngDimensions("icons/icon-512.png")).toEqual({
      width: 512,
      height: 512,
    });
    expect(readPngDimensions("icons/icon-maskable-512.png")).toEqual({
      width: 512,
      height: 512,
    });
  });
});
