import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ selections: 0, queued: [] as unknown[], cursor: null as any, pages: [] as string[] }));
vi.mock("../db/client", () => ({ getDatabase: () => ({
  select: () => { const index = state.selections++; const rows = index === 0 ? [{ name: "Paulinho" }] : index === 1 ? [{ metadata: { day: "2026-10-25", page: 2 } }] : [];
    return { from: () => ({ where: () => ({ limit: async () => rows, orderBy: () => ({ limit: async () => rows }) }) }) };
  },
  insert: () => ({ values: (values: any) => ({ onConflictDoNothing: () => ({ returning: async () => { state.queued.push(values); return [{ id: "queued" }]; } }), onConflictDoUpdate: async () => { state.cursor = values.metadata; } }) }),
}) }));
vi.mock("./retention", () => ({ listMaintenanceReturns: async (_workshop: string, page: string) => { state.pages.push(page); return { page: 2, pageCount: 4, nextPage: 3, items: [{ customerId: "c", customerName: "Ana", phone: "11999990000", consent: true, serviceRecordId: "s", dueAt: new Date("2026-10-25T12:00:00Z"), serviceName: "Troca de óleo", targetOdometer: 55000, odometer: 50000 }] }; } }));
import { scheduleMaintenanceReminders } from "./whatsapp";

afterEach(() => vi.unstubAllEnvs());
describe("bounded reminder scheduler", () => {
  it("queues one due page and persists the next page instead of scanning the history", async () => {
    vi.stubEnv("WHATSAPP_WORKSHOP_ID", "w"); vi.stubEnv("WHATSAPP_REMINDER_TEMPLATE_NAME", "maintenance");
    const inserted = await scheduleMaintenanceReminders(new Date("2026-10-25T12:00:00Z"));
    expect(inserted).toBe(1);
    expect(state.pages).toEqual(["2"]);
    expect(state.cursor).toEqual({ day: "2026-10-25", page: 3 });
    expect(state.queued[0]).toMatchObject({ payload: { serviceName: "Troca de óleo", lastOdometer: 50000 } });
  });
});
