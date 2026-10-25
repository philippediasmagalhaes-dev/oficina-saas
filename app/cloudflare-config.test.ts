import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import cloudflareConfig from "../cloudflare.config";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("Cloudflare build target", () => {
  it("keeps the Next.js commands and adds a pinned parallel deployment path", () => {
    expect(packageJson.scripts).toMatchObject({
      dev: "next dev",
      build: "next build",
      "vercel-build": "npm run db:migrate && next build",
      start: "next start",
    });
    expect(packageJson.scripts["dev:cloudflare"]).toBeTruthy();
    expect(packageJson.scripts["build:cloudflare"]).toBeTruthy();
    expect(packageJson.scripts["preview:cloudflare"]).toBeTruthy();
    expect(packageJson.scripts["deploy:cloudflare"]).toBeTruthy();
    expect(packageJson.scripts["deploy:cloudflare"]).not.toContain("@latest");
    expect(packageJson.scripts["build:cloudflare"]).toContain("next typegen");
    expect(packageJson.scripts["deploy:cloudflare"]).toContain("--skip-build");
  });

  it("commits both Vite and Cloudflare runtime configuration", () => {
    expect(existsSync(resolve(projectRoot, "vite.config.ts"))).toBe(true);
    expect(existsSync(resolve(projectRoot, "cloudflare.config.ts"))).toBe(true);
  });

  it("targets the named Worker with previews and production observability", () => {
    expect(cloudflareConfig.worker).toMatchObject({
      name: "oficina-saas",
      compatibilityDate: "2026-10-21",
      compatibilityFlags: ["nodejs_compat"],
      previewUrls: true,
      observability: { enabled: true },
    });
    expect(cloudflareConfig.worker?.entrypoint).toBe("./worker.ts");
    expect(cloudflareConfig.worker?.triggers).toEqual([{ type: "scheduled", schedule: "0 12 * * *" }]);
  });

  it("requires every production secret when creating a Cloudflare version", () => {
    expect(cloudflareConfig.worker?.env).toMatchObject({
      PLATE_LOOKUP_PROVIDER: { type: "text", value: "fipeplaca" },
    });

    for (const secretName of [
      "AUTH_TRUSTED_ORIGINS",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "PLATE_LOOKUP_API_TOKEN",
      "R2_ACCESS_KEY_ID",
      "R2_ACCOUNT_ID",
      "R2_BUCKET_NAME",
      "R2_SECRET_ACCESS_KEY",
    ]) {
      expect(cloudflareConfig.worker?.env, `${secretName} must be required`).toHaveProperty(secretName, {
        type: "secret",
      });
    }
  });
});
