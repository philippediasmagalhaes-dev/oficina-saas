import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("empty state navigation", () => {
  it("uses a full-document navigation for its action", () => {
    const tree = EmptyState({
      title: "Nenhum cliente",
      description: "Cadastre o primeiro cliente.",
      action: "Cadastrar cliente",
      href: "/clientes/novo",
    });
    const action = Children.toArray(tree.props.children).find(
      (child) =>
        isValidElement<{ children?: ReactNode }>(child) &&
        child.props.children === "Cadastrar cliente",
    ) as ReactElement<{ href: string }>;

    expect(action.type).toBe("a");
    expect(action.props.href).toBe("/clientes/novo");
  });
});
