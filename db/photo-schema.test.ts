import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { servicePhotos } from "./schema";

const migrationPath = resolve(
  import.meta.dirname,
  "migrations/0003_photo_object_storage.sql",
);

describe("service photo object-storage migration", () => {
  it("keeps legacy bytes nullable and adds object metadata", () => {
    const columns = getTableColumns(servicePhotos) as Record<
      string,
      { name: string; notNull: boolean }
    >;

    expect(columns.dataBase64).toMatchObject({
      name: "data_base64",
      notNull: false,
    });
    expect(columns.storageKey).toMatchObject({
      name: "storage_key",
      notNull: false,
    });
    expect(columns.sizeBytes).toMatchObject({
      name: "size_bytes",
      notNull: false,
    });
  });

  it("uses an additive migration that never clears legacy content", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = existsSync(migrationPath)
      ? readFileSync(migrationPath, "utf8")
      : "";

    expect(sql).toContain(
      'ALTER TABLE "service_photos" ALTER COLUMN "data_base64" DROP NOT NULL;',
    );
    expect(sql).toContain(
      'ALTER TABLE "service_photos" ADD COLUMN "storage_key" text;',
    );
    expect(sql).toContain(
      'ALTER TABLE "service_photos" ADD COLUMN "size_bytes" integer;',
    );
    expect(sql).toContain("service_photos_size_nonnegative");
    expect(sql).toContain("service_photos_storage_key_unique");
    expect(sql).not.toMatch(/DROP COLUMN\s+"data_base64"/i);
    expect(sql).not.toMatch(/DELETE FROM\s+"service_photos"/i);
    expect(sql).not.toMatch(/UPDATE\s+"service_photos"[\s\S]*data_base64\s*=\s*null/i);
  });
});
