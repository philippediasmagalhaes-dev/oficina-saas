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
});
