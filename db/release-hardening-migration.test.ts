import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("release hardening migration", () => {
  it("backfills normalized contacts, active stock lifecycle and historical finance additively", () => {
    const path = resolve(import.meta.dirname, "migrations/0007_release_hardening.sql");
    expect(existsSync(path)).toBe(true);
    const sql = existsSync(path) ? readFileSync(path, "utf8") : "";
    expect(sql).toContain('UPDATE "customers"');
    expect(sql).toContain('"phone_normalized"');
    expect(sql).toContain('UPDATE "vehicles"');
    expect(sql).toContain('"plate_normalized"');
    expect(sql).toContain('"reservation_state"');
    expect(sql).toContain('INSERT INTO "financial_entries"');
    expect(sql).toMatch(/ALTER TYPE (?:"public"\.)?"message_outbox_status" ADD VALUE/);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);
  });
});
