import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerPicker } from "./customer-picker";

const customers = Array.from({ length: 1000 }, (_, index) => ({ id: `customer-${index}`, name: `Cliente ${index}` }));
describe("bounded customer selection", () => {
  it("does not serialize the whole customer base into a form", () => {
    const html = renderToStaticMarkup(<CustomerPicker customers={customers} />);
    expect(html.match(/<option/g)).toHaveLength(25);
    expect(html).not.toContain("Cliente 999");
    expect(html).toContain("Pesquisar cliente");
  });
  it("preserves the current owner when editing a vehicle outside the first page", () => {
    const html = renderToStaticMarkup(<CustomerPicker customers={customers} defaultCustomerId="customer-999" />);
    expect(html).toContain('value="customer-999" selected=""');
    expect(html).toContain("Cliente 999");
    expect(html.match(/<option/g)).toHaveLength(26);
  });
});
