import { describe, expect, it } from "vitest";
import {
  assignCollaborator,
  createCollaboratorAdminService,
  summarizeCollaboratorPayables,
  onlyActiveCollaborators,
  type CollaboratorAdminStore,
  type CollaboratorAssignmentStore,
} from "./collaborators";

describe("collaborator assignment boundary", () => {
  it("allows several collaborators while participation remains within 100%", async () => {
    const saved: unknown[] = [];
    const store: CollaboratorAssignmentStore = {
      getLaborItem: async () => ({ id: "item-a", type: "service", financialClosedAt: null }),
      listParticipation: async () => [4000],
      save: async (input) => { saved.push(input); return { id: "assignment-b" }; },
    };
    await expect(assignCollaborator(store, { workshopId: "workshop-a", workOrderItemId: "item-a", collaboratorId: "collab-b", participationBasisPoints: 6000 })).resolves.toEqual({ id: "assignment-b" });
    expect(saved).toHaveLength(1);
  });

  it("blocks assignment to parts and participation above 100%", async () => {
    const partStore: CollaboratorAssignmentStore = { getLaborItem: async () => ({ id: "part-a", type: "part", financialClosedAt: null }), listParticipation: async () => [], save: async () => ({ id: "never" }) };
    await expect(assignCollaborator(partStore, { workshopId: "workshop-a", workOrderItemId: "part-a", collaboratorId: "collab-a", participationBasisPoints: 10000 })).rejects.toThrow("mão de obra");
    const excessStore: CollaboratorAssignmentStore = { getLaborItem: async () => ({ id: "item-a", type: "service", financialClosedAt: null }), listParticipation: async () => [5001], save: async () => ({ id: "never" }) };
    await expect(assignCollaborator(excessStore, { workshopId: "workshop-a", workOrderItemId: "item-a", collaboratorId: "collab-a", participationBasisPoints: 5000 })).rejects.toThrow("100%");
  });

  it("keeps closed compensation snapshots immutable", async () => {
    const store: CollaboratorAssignmentStore = { getLaborItem: async () => ({ id: "item-a", type: "service", financialClosedAt: new Date() }), listParticipation: async () => [], save: async () => ({ id: "never" }) };
    await expect(assignCollaborator(store, { workshopId: "workshop-a", workOrderItemId: "item-a", collaboratorId: "collab-a", participationBasisPoints: 5000 })).rejects.toThrow("já foi fechada");
  });
});

describe("collaborator rule administration", () => {
  it("keeps inactive collaborators out of new assignment options", () => {
    expect(onlyActiveCollaborators([
      { id: "active", active: true },
      { id: "inactive", active: false },
    ])).toEqual([{ id: "active", active: true }]);
  });

  function store(existing = true): CollaboratorAdminStore & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      update: async () => {
        calls.push("update");
        return existing ? { id: "collab-a" } : null;
      },
      deactivate: async () => {
        calls.push("deactivate");
        return existing;
      },
      deleteRate: async () => {
        calls.push("delete-rate");
        return existing;
      },
    };
  }

  it("rejects collaborator updates outside the workshop boundary", async () => {
    const unavailable = store(false);
    const service = createCollaboratorAdminService(unavailable);
    await expect(
      service.update({
        workshopId: "workshop-a",
        collaboratorId: "collab-other",
        name: "Mecânico",
        phone: null,
        compensationMode: "percentage",
        monthlyFixedCents: 0,
        fixedPerServiceCents: 0,
        commissionBasisPoints: 2000,
      }),
    ).rejects.toThrow("Colaborador não encontrado");
    expect(unavailable.calls).toEqual(["update"]);
  });

  it("deletes only the selected service-specific rule", async () => {
    const available = store(true);
    const service = createCollaboratorAdminService(available);
    await expect(service.deleteRate("workshop-a", "rate-a")).resolves.toBeUndefined();
    expect(available.calls).toEqual(["delete-rate"]);
  });
});

describe("collaborator payable report", () => {
  it("separates commission, fixed pay, settled, and pending totals", () => {
    expect(
      summarizeCollaboratorPayables([
        { collaboratorId: "a", collaboratorName: "Ana", category: "labor_compensation", status: "expected", amountCents: 12000 },
        { collaboratorId: "a", collaboratorName: "Ana", category: "labor_compensation", status: "settled", amountCents: 8000 },
        { collaboratorId: "a", collaboratorName: "Ana", category: "fixed_payroll", status: "expected", amountCents: 100000 },
        { collaboratorId: "b", collaboratorName: "Bruno", category: "labor_compensation", status: "cancelled", amountCents: 99999 },
      ]),
    ).toEqual([
      {
        collaboratorId: "a",
        collaboratorName: "Ana",
        commissionCents: 20000,
        fixedCents: 100000,
        settledCents: 8000,
        pendingCents: 112000,
        totalCents: 120000,
      },
    ]);
  });
});
