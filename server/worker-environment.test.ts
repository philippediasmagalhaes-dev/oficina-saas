import { describe, expect, it } from "vitest";
import {
  getWorkerEnvironment,
  syncWorkerEnvironment,
} from "./worker-environment";

describe("Cloudflare runtime bindings", () => {
  it("disponibiliza textos e segredos do Worker para as rotas Next", () => {
    const processEnv: Record<string, string | undefined> = {};
    const runtimeStore = {};

    syncWorkerEnvironment(
      {
        PLATE_LOOKUP_PROVIDER: "fipeplaca",
        PLATE_LOOKUP_API_TOKEN: "fp_live_test",
        ASSETS: { fetch: () => Promise.resolve(new Response()) },
      },
      processEnv,
      runtimeStore,
    );

    expect(processEnv).toEqual({
      PLATE_LOOKUP_PROVIDER: "fipeplaca",
      PLATE_LOOKUP_API_TOKEN: "fp_live_test",
    });
    expect(getWorkerEnvironment({}, runtimeStore)).toEqual({
      PLATE_LOOKUP_PROVIDER: "fipeplaca",
      PLATE_LOOKUP_API_TOKEN: "fp_live_test",
    });
  });
});
