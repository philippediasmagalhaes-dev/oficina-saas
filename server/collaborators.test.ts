import { describe, expect, it } from "vitest";
import { assignCollaborator, type CollaboratorAssignmentStore } from "./collaborators";

describe("collaborator assignment boundary", () => {
  it("allows several collaborators while participation remains within 100%", async () => {
    const saved: unknown[] = [];
    const store: CollaboratorAssignmentStore = {
      getLaborItem: async () => ({ id: "item-a", type: "service" }),
      listParticipation: async () => [4000],
      save: async (input) => { saved.push(input); return { id: "assignment-b" }; },
    };
    await expect(assignCollaborator(store, { workshopId: "workshop-a", workOrderItemId: "item-a", collaboratorId: "collab-b", participationBasisPoints: 6000 })).resolves.toEqual({ id: "assignment-b" });
    expect(saved).toHaveLength(1);
  });

  it("blocks assignment to parts and participation above 100%", async () => {
    const partStore: CollaboratorAssignmentStore = { getLaborItem: async () => ({ id: "part-a", type: "part" }), listParticipation: async () => [], save: async () => ({ id: "never" }) };
    await expect(assignCollaborator(partStore, { workshopId: "workshop-a", workOrderItemId: "part-a", collaboratorId: "collab-a", participationBasisPoints: 10000 })).rejects.toThrow("mão de obra");
    const excessStore: CollaboratorAssignmentStore = { getLaborItem: async () => ({ id: "item-a", type: "service" }), listParticipation: async () => [5001], save: async () => ({ id: "never" }) };
    await expect(assignCollaborator(excessStore, { workshopId: "workshop-a", workOrderItemId: "item-a", collaboratorId: "collab-a", participationBasisPoints: 5000 })).rejects.toThrow("100%");
  });
});
