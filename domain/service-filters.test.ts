import { describe, expect, it } from "vitest";
import {
  describeFinancialPeriod,
  filterFinancialServices,
  parseFinancialPeriod,
  type FinancialFilters,
} from "./service-filters";

const services = [
  { description: "Troca de óleo", customerName: "Ana", vehicleLabel: "Honda Civic", completedAt: new Date("2026-09-05T12:00:00Z") },
  { description: "Revisão", customerName: "Bruno", vehicleLabel: "Fiat Toro", completedAt: new Date("2026-08-10T12:00:00Z") },
  { description: "Freios", customerName: "José", vehicleLabel: "VW Gol", completedAt: new Date("2026-01-15T12:00:00Z") },
];

function filters(input: Partial<FinancialFilters> = {}): FinancialFilters {
  return { period: "current_month", query: "", from: "", to: "", ...input };
}

describe("financial service filters", () => {
  it("defaults unknown periods to the current month", () => {
    expect(parseFinancialPeriod("unknown")).toBe("current_month");
  });

  it("shows only current-month services by default", () => {
    expect(filterFinancialServices(services, filters(), new Date("2026-09-20T12:00:00Z"))).toEqual([services[0]]);
  });

  it("filters previous month and the current year", () => {
    expect(filterFinancialServices(services, filters({ period: "previous_month" }), new Date("2026-09-20T12:00:00Z"))).toEqual([services[1]]);
    expect(filterFinancialServices(services, filters({ period: "current_year" }), new Date("2026-09-20T12:00:00Z"))).toHaveLength(3);
  });

  it("searches without accents across customer, service and vehicle", () => {
    expect(filterFinancialServices(services, filters({ period: "all", query: "oleo" }))).toEqual([services[0]]);
    expect(filterFinancialServices(services, filters({ period: "all", query: "jose" }))).toEqual([services[2]]);
    expect(filterFinancialServices(services, filters({ period: "all", query: "toro" }))).toEqual([services[1]]);
  });

  it("gives custom dates priority and includes both boundary days", () => {
    const result = filterFinancialServices(services, filters({ from: "2026-08-10", to: "2026-09-05" }));
    expect(result).toEqual([services[0], services[1]]);
    expect(describeFinancialPeriod(filters({ from: "2026-08-10", to: "2026-09-05" }))).toBe("10/08/2026 até 05/09/2026");
  });
});
