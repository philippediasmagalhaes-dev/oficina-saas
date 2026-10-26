import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const columnNames = (table: unknown) =>
  table
    ? Object.values(getTableColumns(table as never) as Record<string, { name: string }>).map((column) => column.name)
    : [];

describe("real workshop operations schema", () => {
  it("extends workshop, customer, vehicle, order, item and inventory records", () => {
    expect(columnNames(schema.workshops)).toEqual(
      expect.arrayContaining(["legal_name", "document", "whatsapp_number", "address_street", "print_terms"]),
    );
    expect(columnNames(schema.customers)).toEqual(
      expect.arrayContaining(["document", "phone_normalized", "address_street", "whatsapp_consent_at", "whatsapp_opt_out_at"]),
    );
    expect(columnNames(schema.vehicles)).toEqual(
      expect.arrayContaining(["plate_normalized", "category", "color", "model_year", "fuel", "masked_chassis", "lookup_provider"]),
    );
    expect(columnNames(schema.serviceRecords)).toEqual(
      expect.arrayContaining(["order_number", "financial_closed_at", "tax_basis_points", "tax_reserve_cents", "quote_version"]),
    );
    expect(columnNames(schema.workOrderItems)).toEqual(
      expect.arrayContaining(["cost_cents", "discount_cents", "approval_state", "reservation_state"]),
    );
    expect(columnNames(schema.inventoryItems)).toContain("reserved_quantity");
  });

  it("defines every operational aggregate required by the approved pilot", () => {
    const required = [
      "workshopFinancialSettings",
      "paymentFeeRules",
      "workshopSequences",
      "workshopIntegrations",
      "messageTemplates",
      "vehicleInspections",
      "inspectionDamageMarks",
      "workOrderStatusEvents",
      "workOrderApprovals",
      "collaborators",
      "collaboratorServiceRates",
      "workOrderItemAssignments",
      "workOrderPayments",
      "financialEntries",
      "financialAttachments",
      "financialEntryEvents",
      "messageOutbox",
      "messageDeliveries",
      "businessFinExports",
    ];

    for (const name of required) expect(schema).toHaveProperty(name);
  });

  it("defines professional accounts, suppliers, settlements and cash sessions", () => {
    expect(schema).toHaveProperty("financialAccounts");
    expect(schema).toHaveProperty("suppliers");
    expect(schema).toHaveProperty("financialSettlements");
    expect(schema).toHaveProperty("cashSessions");
    expect(columnNames(schema.financialEntries)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "supplier_id",
        "financial_account_id",
        "installment_group_id",
        "installment_number",
        "installment_count",
        "document_number",
        "notes",
      ]),
    );
    expect(columnNames(schema.businessFinExports)).toContain("settlement_id");
  });

  it("ships the professional finance migration as an additive change", () => {
    const migrationPath = resolve(
      import.meta.dirname,
      "migrations/0013_professional_finance.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);
    const sql = existsSync(migrationPath)
      ? readFileSync(migrationPath, "utf8")
      : "";
    expect(sql).toContain('CREATE TABLE "financial_accounts"');
    expect(sql).toContain('CREATE TABLE "suppliers"');
    expect(sql).toContain('CREATE TABLE "financial_settlements"');
    expect(sql).toContain('CREATE TABLE "cash_sessions"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/TRUNCATE|DELETE\s+FROM/i);
  });

  it("prevents concurrent open cash sessions with an additive index migration", () => {
    const migrationPath = resolve(import.meta.dirname, "migrations/0014_cash_session_integrity.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
    expect(sql).toContain("cash_sessions_one_open_per_account");
    expect(sql).toMatch(/WHERE .*closed_at.*IS NULL/i);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  });

  it("ships an additive migration without deleting existing workshop data", () => {
    const migrationPath = resolve(import.meta.dirname, "migrations/0004_real_workshop_operations.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
    expect(sql).toContain('ALTER TABLE "service_records" ADD COLUMN "order_number" integer;');
    expect(sql).toContain('CREATE TABLE "collaborators"');
    expect(sql).toContain('CREATE TABLE "financial_entries"');
    expect(sql).toContain('CREATE TABLE "message_outbox"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/TRUNCATE|DELETE\s+FROM/i);
  });
});
