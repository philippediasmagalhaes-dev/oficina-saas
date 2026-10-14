export type WorkshopDataCounts = {
  customers: number;
  vehicles: number;
  serviceRecords: number;
  inventoryItems: number;
  serviceCatalogItems: number;
  contactEvents: number;
};

export type WorkshopRecoveryCandidate = {
  id: string;
  ownerUserId: string;
  updatedAt: Date;
  counts: WorkshopDataCounts;
};

export type SelectedWorkshop = WorkshopRecoveryCandidate & { score: number };

type RecoveryUser = { id: string; email: string };

export type OwnerIdentityRecoveryPlan = {
  selectedOwnerId: string;
  desiredEmail: string;
  displacedUser: { id: string; replacementEmail: string } | null;
};

function dataScore(counts: WorkshopDataCounts): number {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

export function selectWorkshopForRecovery(
  candidates: WorkshopRecoveryCandidate[],
): SelectedWorkshop | null {
  const ranked = candidates.map((candidate) => ({
    ...candidate,
    score: dataScore(candidate.counts),
  }));
  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  return ranked[0] ?? null;
}

export function planOwnerIdentityRecovery({
  selectedOwner,
  users,
  desiredEmail,
}: {
  selectedOwner: RecoveryUser;
  users: RecoveryUser[];
  desiredEmail: string;
}): OwnerIdentityRecoveryPlan {
  const normalizedEmail = desiredEmail.trim().toLowerCase();
  const conflictingUser = users.find(
    (candidate) =>
      candidate.id !== selectedOwner.id &&
      candidate.email.toLowerCase() === normalizedEmail,
  );
  return {
    selectedOwnerId: selectedOwner.id,
    desiredEmail: normalizedEmail,
    displacedUser: conflictingUser
      ? { id: conflictingUser.id, replacementEmail: selectedOwner.email }
      : null,
  };
}
