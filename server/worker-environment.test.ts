import { describe, expect, it } from "vitest";
import { syncWorkerEnvironment } from "./worker-environment";

describe("Cloudflare runtime bindings", () => {
  it("disponibiliza textos e segredos do Worker para as rotas Next", () => {
    const processEnv: Record<string, string | undefined> = {};

    syncWorkerEnvironment(
      {
        PLATE_LOOKUP_PROVIDER: "fipeplaca",
        PLATE_LOOKUP_API_TOKEN: "fp_live_test",
        ASSETS: { fetch: () => Promise.resolve(new Response()) },
      },
      processEnv,
    );

    expect(processEnv).toEqual({
      PLATE_LOOKUP_PROVIDER: "fipeplaca",
      PLATE_LOOKUP_API_TOKEN: "fp_live_test",
    });
  });
});
