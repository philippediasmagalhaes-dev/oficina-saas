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
      AUTH_TRUSTED_ORIGINS: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      DATABASE_URL: bindings.secret(),
      NEXT_PUBLIC_APP_URL: bindings.secret(),
      PLATE_LOOKUP_API_TOKEN: bindings.secret(),
      PLATE_LOOKUP_PROVIDER: bindings.text("fipeplaca"),
      R2_ACCESS_KEY_ID: bindings.secret(),
      R2_ACCOUNT_ID: bindings.secret(),
      R2_BUCKET_NAME: bindings.secret(),
      R2_SECRET_ACCESS_KEY: bindings.secret(),
    },
  }),
});
