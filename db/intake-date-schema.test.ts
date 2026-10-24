import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { serviceRecords } from "./schema";

describe("service record intake date", () => {
  it("stores an explicitly nullable intake date independently from createdAt", () => {
    const columns = getTableColumns(serviceRecords);

    expect(columns.intakeAt.name).toBe("intake_at");
    expect(columns.intakeAt.notNull).toBe(false);
    expect(columns.createdAt.notNull).toBe(true);
  });
});
