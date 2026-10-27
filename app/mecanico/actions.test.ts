import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ writes: [] as Record<string, unknown>[], transitions: [] as string[] }));
vi.mock("next/cache", () => ({ revalidatePath() {} }));
vi.mock("../../server/mechanic-access", () => ({ verifyMechanicAccess: async () => ({ workshopId: "w", serviceRecordId: "s" }) }));
vi.mock("../../db/client", () => ({ getDatabase: () => ({ update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { state.writes.push(values); } }) }) }) }));
vi.mock("../../server/work-orders", () => ({ getWorkOrder: async () => ({ status: "in_progress", customerWhatsappConsent: false, customerPhone: null }), updateWorkOrderStatus: async (_w: string, _s: string, status: string) => { state.transitions.push(status); }, saveDiagnosis: async () => {}, addServicePhoto: async () => {} }));
vi.mock("../../server/whatsapp", () => ({ normalizeReadyRecipient: () => null, enqueueVehicleReadyMessage: async () => false }));
import { saveMechanicWorkAction } from "./actions";

describe("mechanic completion", () => {
  beforeEach(() => { state.writes.length = 0; state.transitions.length = 0; });
  it("saves the submitted notes and mileage before completing the service", async () => {
    const form = new FormData();
    form.set("mechanicToken", "test"); form.set("task", "ready");
    form.set("mechanicNotes", "Filtro substituído e testes concluídos"); form.set("odometer", "55000");
    await saveMechanicWorkAction(form);
    expect(state.writes[0]).toMatchObject({ mechanicNotes: "Filtro substituído e testes concluídos", odometer: 55000 });
    expect(state.transitions).toEqual(["ready"]);
  });
});
