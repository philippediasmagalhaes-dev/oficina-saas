import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollaboratorEditForm } from "./collaborator-form";

describe("collaborator edit form", () => {
  it("offers safe collaborator deletion and explains history preservation", () => {
    const html = renderToStaticMarkup(<CollaboratorEditForm collaborator={{
      id: "collab-a",
      name: "Ana",
      phone: null,
      compensationMode: "percentage",
      monthlyFixedCents: 0,
      fixedPerServiceCents: 0,
      commissionBasisPoints: 1500,
      active: true,
    }} />);
    expect(html).toContain("Excluir colaborador");
    expect(html).toContain("histórico");
  });
});
