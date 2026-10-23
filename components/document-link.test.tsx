import { describe, expect, it } from "vitest";

describe("document link", () => {
  it("renders a native anchor so the browser loads the destination document", async () => {
    const { DocumentLink } = await import("./document-link");
    const link = DocumentLink({
      href: "/clientes",
      className: "nav-link",
      children: "Clientes",
    });

    expect(link.type).toBe("a");
    expect(link.props).toMatchObject({
      href: "/clientes",
      className: "nav-link",
      children: "Clientes",
    });
  });
});
