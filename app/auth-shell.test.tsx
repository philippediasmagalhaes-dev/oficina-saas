import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login/login-form";
import { ConfigurationPending } from "./configurar/page";

describe("owner authentication shell", () => {
  it("renders an owner-only login without public registration", () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain("Acesso do proprietário");
    expect(html).not.toContain("Criar conta");
  });

  it("lists only missing variable names", () => {
    const html = renderToStaticMarkup(<ConfigurationPending missing={["DATABASE_URL", "BETTER_AUTH_SECRET"]} />);
    expect(html).toContain("Configuração pendente");
    expect(html).toContain("DATABASE_URL");
    expect(html).not.toContain("postgresql://");
  });
});
