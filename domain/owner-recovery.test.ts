import { describe, expect, it } from "vitest";
import {
  planOwnerIdentityRecovery,
  selectWorkshopForRecovery,
} from "./owner-recovery";

const emptyCounts = {
  customers: 0,
  vehicles: 0,
  serviceRecords: 0,
  inventoryItems: 0,
  serviceCatalogItems: 0,
  contactEvents: 0,
};

describe("owner recovery workshop selection", () => {
  it("selects the workshop with the greatest amount of business data", () => {
    const selected = selectWorkshopForRecovery([
      {
        id: "workshop-empty",
        ownerUserId: "owner-empty",
        updatedAt: new Date("2026-10-14T10:00:00Z"),
        counts: emptyCounts,
      },
      {
        id: "workshop-active",
        ownerUserId: "owner-active",
        updatedAt: new Date("2026-09-01T10:00:00Z"),
        counts: {
          ...emptyCounts,
          customers: 8,
          vehicles: 5,
          serviceRecords: 12,
        },
      },
    ]);

    expect(selected?.id).toBe("workshop-active");
    expect(selected?.score).toBe(25);
  });

  it("uses the most recently updated workshop when data totals are tied", () => {
    const selected = selectWorkshopForRecovery([
      {
        id: "workshop-old",
        ownerUserId: "owner-old",
        updatedAt: new Date("2026-01-01T10:00:00Z"),
        counts: { ...emptyCounts, customers: 2 },
      },
      {
        id: "workshop-new",
        ownerUserId: "owner-new",
        updatedAt: new Date("2026-10-01T10:00:00Z"),
        counts: { ...emptyCounts, serviceRecords: 2 },
      },
    ]);

    expect(selected?.id).toBe("workshop-new");
  });

  it("returns null when there is no workshop to recover", () => {
    expect(selectWorkshopForRecovery([])).toBeNull();
  });
});

describe("owner recovery identity plan", () => {
  it("assigns the desired email to the selected workshop owner", () => {
    expect(
      planOwnerIdentityRecovery({
        selectedOwner: { id: "owner-active", email: "old@example.com" },
        users: [{ id: "owner-active", email: "old@example.com" }],
        desiredEmail: "philippe@example.com",
      }),
    ).toEqual({
      selectedOwnerId: "owner-active",
      desiredEmail: "philippe@example.com",
      displacedUser: null,
    });
  });

  it("preserves a conflicting account by swapping it to the selected owner's previous email", () => {
    expect(
      planOwnerIdentityRecovery({
        selectedOwner: { id: "owner-active", email: "old@example.com" },
        users: [
          { id: "owner-active", email: "old@example.com" },
          { id: "owner-conflict", email: "philippe@example.com" },
        ],
        desiredEmail: "philippe@example.com",
      }),
    ).toEqual({
      selectedOwnerId: "owner-active",
      desiredEmail: "philippe@example.com",
      displacedUser: {
        id: "owner-conflict",
        replacementEmail: "old@example.com",
      },
    });
  });

  it("does not displace the selected owner when it already has the desired email", () => {
    expect(
      planOwnerIdentityRecovery({
        selectedOwner: {
          id: "owner-active",
          email: "philippe@example.com",
        },
        users: [
          { id: "owner-active", email: "philippe@example.com" },
          { id: "owner-other", email: "other@example.com" },
        ],
        desiredEmail: "philippe@example.com",
      }),
    ).toEqual({
      selectedOwnerId: "owner-active",
      desiredEmail: "philippe@example.com",
      displacedUser: null,
    });
  });
});
