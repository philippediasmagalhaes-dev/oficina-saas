import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("global control styles", () => {
  it("defines a branded scrollbar for the page and scrollable panels", () => {
    expect(css).toContain("scrollbar-color: var(--yellow) transparent");
    expect(css).toContain("::-webkit-scrollbar-thumb");
  });

  it("keeps checkboxes compact instead of inheriting text input dimensions", () => {
    expect(css).toMatch(/input\[type=["']checkbox["']\][\s\S]*inline-size:\s*1\.05rem/);
    expect(css).toMatch(/input\[type=["']checkbox["']\][\s\S]*padding:\s*0/);
  });

  it("uses one control height for primary and secondary actions", () => {
    expect(css).toContain("--control-height: 2.45rem");
    expect(css).toMatch(/\.primary-button,[\s\S]*\.secondary-button[\s\S]*height:\s*var\(--control-height\)/);
  });

  it("keeps the settlement panel in the mobile table flow", () => {
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.settlement-popover\s*\{[^}]*position:\s*static/);
  });
});
