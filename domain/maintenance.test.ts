import { describe, expect, it } from "vitest";
import { forecastMaintenance, isOilChange, maintenanceDraft } from "./maintenance";

describe("maintenance forecast", () => {
  it("uses six calendar months without reliable mileage history", () => {
    const result = forecastMaintenance({ serviceName: "Troca de óleo", completedAt: new Date("2026-08-31T12:00:00Z"), odometer: 50000 });
    expect(result.dueAt.toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(result.targetOdometer).toBe(55000);
    expect(result.source).toBe("standard");
  });

  it("learns an earlier return from the same vehicle's oil-change mileage", () => {
    const result = forecastMaintenance({ serviceName: "Troca de óleo", completedAt: new Date("2026-10-01T12:00:00Z"), odometer: 55000, previousAt: new Date("2026-09-01T12:00:00Z"), previousOdometer: 50000 });
    expect(result.dueAt.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(result.source).toBe("learned");
    expect(result.targetOdometer).toBe(60000);
  });

  it("ignores decreasing mileage and never learns a later return than six months", () => {
    const invalid = forecastMaintenance({ serviceName: "Troca de óleo", completedAt: new Date("2026-10-01"), odometer: 1000, previousAt: new Date("2026-09-01"), previousOdometer: 9000 });
    expect(invalid.source).toBe("standard");
    const slow = forecastMaintenance({ serviceName: "Troca de óleo", completedAt: new Date("2026-10-01"), odometer: 11000, previousAt: new Date("2026-04-01"), previousOdometer: 10000 });
    expect(slow.dueAt.toISOString().slice(0, 10)).toBe("2027-04-01");
  });

  it("recognizes oil changes without confusing a leak diagnosis", () => {
    expect(isOilChange("Troca de óleo e filtro")).toBe(true);
    expect(isOilChange("Vazamento de óleo")).toBe(false);
  });

  it("builds a service-specific draft with actual last mileage and opt-out", () => {
    const draft = maintenanceDraft({ phone: "11999990000", consent: true, customer: "Ana", workshop: "Paulinho", serviceName: "Troca de óleo", vehicle: "Corsa ABC1D23", lastOdometer: 50000, targetOdometer: 55000, dueAt: new Date("2027-04-01T12:00:00Z") });
    expect(draft?.message).toContain("50.000 km");
    expect(draft?.message).toContain("55.000 km");
    expect(draft?.message).toContain("Troca de óleo");
    expect(draft?.message).toContain("SAIR");
    expect(maintenanceDraft({ phone: "11999990000", consent: false, customer: "Ana", workshop: "Paulinho", serviceName: "Troca de óleo", vehicle: "Corsa", lastOdometer: null, targetOdometer: null, dueAt: new Date() })).toBeNull();
  });
});
