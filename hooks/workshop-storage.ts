import {
  cloneWorkshopState,
  parseWorkshop,
  serializeWorkshop,
  type WorkshopState,
  WORKSHOP_STORAGE_KEY,
} from "../lib/workshop";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadWorkshop(storage: StorageLike | undefined): WorkshopState {
  if (!storage) return cloneWorkshopState();
  try {
    return parseWorkshop(storage.getItem(WORKSHOP_STORAGE_KEY));
  } catch {
    return cloneWorkshopState();
  }
}

export function saveWorkshop(
  storage: StorageLike | undefined,
  state: WorkshopState,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WORKSHOP_STORAGE_KEY, serializeWorkshop(state));
    return true;
  } catch {
    return false;
  }
}
