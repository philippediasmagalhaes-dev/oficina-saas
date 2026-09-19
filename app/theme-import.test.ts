import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global theme loading", () => {
  it("loads the brand overrides after the base stylesheet", () => {
    const layout = readFileSync(
      new URL("./layout.tsx", import.meta.url),
      "utf8",
    );
    const globals = readFileSync(
      new URL("./globals.css", import.meta.url),
      "utf8",
    );

    expect(layout.indexOf('import "./globals.css"')).toBeLessThan(
      layout.indexOf('import "./brand.css"'),
    );
    expect(globals).not.toContain('@import "./brand.css"');
  });

  it("uses the active production domain in metadata defaults", () => {
    const layout = readFileSync(
      new URL("./layout.tsx", import.meta.url),
      "utf8",
    );
    const environmentExample = readFileSync(
      new URL("../.env.example", import.meta.url),
      "utf8",
    );
    const productionUrl = "https://oficina-saas-green.vercel.app";

    expect(layout).toContain(productionUrl);
    expect(environmentExample).toContain(
      `NEXT_PUBLIC_APP_URL=${productionUrl}`,
    );
  });
});
