import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "oficina-saas",
    entrypoint: "./worker.ts",
    compatibilityDate: "2026-10-21",
    compatibilityFlags: ["nodejs_compat"],
    previewUrls: true,
    observability: { enabled: true },
    triggers: [triggers.scheduled({ schedule: "0 12 * * *" })],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
