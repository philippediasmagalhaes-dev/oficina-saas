CREATE UNIQUE INDEX "cash_sessions_one_open_per_account" ON "cash_sessions" USING btree ("workshop_id","financial_account_id") WHERE "closed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "business_fin_exports" ADD COLUMN "settlement_id" uuid;--> statement-breakpoint
ALTER TABLE "business_fin_exports" ADD CONSTRAINT "business_fin_exports_settlement_id_financial_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."financial_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "business_fin_exports_entry_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "business_fin_exports_entry_unique" ON "business_fin_exports" USING btree ("workshop_id","financial_entry_id") WHERE "settlement_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "business_fin_exports_settlement_unique" ON "business_fin_exports" USING btree ("workshop_id","settlement_id") WHERE "settlement_id" IS NOT NULL;
