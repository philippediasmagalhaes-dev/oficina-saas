import { describe, expect, it } from "vitest";
import {
  migrateLegacyPhotos,
  type LegacyPhotoRow,
  type PhotoMigrationRepository,
} from "./photo-migration";
import type { PhotoStorage } from "./photo-storage";

function legacyPhoto(id: string, overrides: Partial<LegacyPhotoRow> = {}): LegacyPhotoRow {
  return {
    id,
    workshopId: "workshop-a",
    serviceRecordId: "order-a",
    mimeType: "image/jpeg",
    dataBase64: "AQID",
    storageKey: null,
    ...overrides,
  };
}

function setup(rows: LegacyPhotoRow[]) {
  const records = new Map(rows.map((row) => [row.id, { ...row }]));
  const puts: string[] = [];
  const deletes: string[] = [];
  const updates: string[] = [];
  const logs: string[] = [];

  const repository: PhotoMigrationRepository = {
    async listLegacyPhotos({ afterId, limit }) {
      return [...records.values()]
        .filter((row) => !afterId || row.id > afterId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, limit);
    },
    async markMigrated({ id, storageKey, sizeBytes }) {
      const row = records.get(id);
      if (!row || row.storageKey || !row.dataBase64) return false;
      records.set(id, { ...row, storageKey, sizeBytes });
      updates.push(id);
      return true;
    },
  };

  const storage: PhotoStorage = {
    async put(key) {
      puts.push(key);
    },
    async get() {
      return { body: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };
    },
    async delete(key) {
      deletes.push(key);
    },
  };

  return { repository, storage, records, puts, deletes, updates, logs };
}

describe("legacy photo migration", () => {
  it("skips rows that are already migrated or no longer have legacy data", async () => {
    const context = setup([
      legacyPhoto("photo-a", { storageKey: "existing.jpg", sizeBytes: 3 }),
      legacyPhoto("photo-b", { dataBase64: null }),
    ]);

    await expect(
      migrateLegacyPhotos({
        repository: context.repository,
        storage: context.storage,
        log: (message) => context.logs.push(message),
      }),
    ).resolves.toEqual({ candidate: 0, migrated: 0, skipped: 2, failed: 0 });
    expect(context.puts).toEqual([]);
    expect(context.updates).toEqual([]);
  });

  it("reports dry-run candidates without writing storage or metadata", async () => {
    const context = setup([legacyPhoto("photo-a"), legacyPhoto("photo-b")]);

    await expect(
      migrateLegacyPhotos({
        repository: context.repository,
        storage: context.storage,
        dryRun: true,
        log: (message) => context.logs.push(message),
      }),
    ).resolves.toEqual({ candidate: 2, migrated: 0, skipped: 0, failed: 0 });
    expect(context.puts).toEqual([]);
    expect(context.updates).toEqual([]);
    expect(context.logs).toEqual([
      "photo photo-a: candidate",
      "photo photo-b: candidate",
    ]);
  });

  it("uploads, verifies byte length and only then records metadata", async () => {
    const context = setup([legacyPhoto("photo-a")]);

    await expect(
      migrateLegacyPhotos({ repository: context.repository, storage: context.storage }),
    ).resolves.toEqual({ candidate: 1, migrated: 1, skipped: 0, failed: 0 });
    expect(context.puts).toEqual([
      "workshops/workshop-a/orders/order-a/photo-a.jpg",
    ]);
    expect(context.updates).toEqual(["photo-a"]);
    expect(context.records.get("photo-a")).toMatchObject({
      storageKey: "workshops/workshop-a/orders/order-a/photo-a.jpg",
      sizeBytes: 3,
      dataBase64: "AQID",
    });
  });

  it("is idempotent when run again", async () => {
    const context = setup([legacyPhoto("photo-a")]);
    const first = await migrateLegacyPhotos({
      repository: context.repository,
      storage: context.storage,
    });
    const second = await migrateLegacyPhotos({
      repository: context.repository,
      storage: context.storage,
    });

    expect(first.migrated).toBe(1);
    expect(second).toEqual({ candidate: 0, migrated: 0, skipped: 1, failed: 0 });
    expect(context.puts).toHaveLength(1);
  });

  it("keeps legacy data untouched when verification length differs", async () => {
    const context = setup([legacyPhoto("photo-a")]);
    context.storage.get = async () => ({
      body: new Uint8Array([1, 2]),
      contentType: "image/jpeg",
    });

    await expect(
      migrateLegacyPhotos({ repository: context.repository, storage: context.storage }),
    ).resolves.toEqual({ candidate: 1, migrated: 0, skipped: 0, failed: 1 });
    expect(context.updates).toEqual([]);
    expect(context.deletes).toEqual([
      "workshops/workshop-a/orders/order-a/photo-a.jpg",
    ]);
    expect(context.records.get("photo-a")).toMatchObject({
      storageKey: null,
      dataBase64: "AQID",
    });
  });

  it("continues with remaining rows after one upload fails", async () => {
    const context = setup([legacyPhoto("photo-a"), legacyPhoto("photo-b")]);
    const originalPut = context.storage.put;
    context.storage.put = async (key, body, contentType) => {
      if (key.endsWith("photo-a.jpg")) throw new Error("secret credential must not leak");
      return originalPut(key, body, contentType);
    };

    await expect(
      migrateLegacyPhotos({
        repository: context.repository,
        storage: context.storage,
        batchSize: 2,
        log: (message) => context.logs.push(message),
      }),
    ).resolves.toEqual({ candidate: 2, migrated: 1, skipped: 0, failed: 1 });
    expect(context.updates).toEqual(["photo-b"]);
    expect(context.logs.join("\n")).toContain("photo photo-a: failed");
    expect(context.logs.join("\n")).toContain("photo photo-b: migrated");
    expect(context.logs.join("\n")).not.toContain("AQID");
    expect(context.logs.join("\n")).not.toContain("secret credential");
  });
});
