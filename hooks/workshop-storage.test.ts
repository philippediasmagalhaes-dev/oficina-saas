import { describe, expect, it } from "vitest";
import { initialWorkshopState, WORKSHOP_STORAGE_KEY } from "../lib/workshop";
import {
  loadWorkshop,
  saveWorkshop,
  type StorageLike,
} from "./workshop-storage";

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("workshop storage boundary", () => {
  it("returns seed data when storage is unavailable during server rendering", () => {
    expect(loadWorkshop(undefined)).toEqual(initialWorkshopState);
  });

  it("writes and restores state through the versioned storage key", () => {
    const storage = memoryStorage();
    const changed = {
      ...initialWorkshopState,
      clients: [
        { ...initialWorkshopState.clients[0], name: "Cliente persistido" },
      ],
    };

    expect(saveWorkshop(storage, changed)).toBe(true);
    expect(storage.values.has(WORKSHOP_STORAGE_KEY)).toBe(true);
    expect(loadWorkshop(storage).clients[0].name).toBe("Cliente persistido");
  });

  it("keeps the app usable when browser storage throws", () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(loadWorkshop(blocked)).toEqual(initialWorkshopState);
    expect(saveWorkshop(blocked, initialWorkshopState)).toBe(false);
  });
});
