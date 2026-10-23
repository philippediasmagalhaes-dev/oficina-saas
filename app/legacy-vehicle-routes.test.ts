import { describe, expect, it } from "vitest";

describe("legacy vehicle routes", () => {
  it("redirects the former vehicle list URL to the canonical list", async () => {
    const routePath = "./motos/page";

    await expect(async () => {
      const route = await import(routePath);
      await route.default();
    }).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT;replace;/veiculos"),
    });
  });

  it("preserves the vehicle id when redirecting an old detail URL", async () => {
    const routePath = "./motos/[id]/page";
    const vehicleId = "00000000-0000-4000-8000-000000000000";

    await expect(async () => {
      const route = await import(routePath);
      await route.default({ params: Promise.resolve({ id: vehicleId }) });
    }).rejects.toMatchObject({
      digest: expect.stringContaining(
        `NEXT_REDIRECT;replace;/veiculos/${vehicleId}`,
      ),
    });
  });
});
