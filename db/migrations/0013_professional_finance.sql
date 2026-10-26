ALTER TYPE "public"."financial_status" ADD VALUE IF NOT EXISTS 'partial' BEFORE 'settled';--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'cash' NOT NULL,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"system_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"phone" text,
	"email" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "financial_account_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "installment_group_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "installment_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "installment_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE TABLE "financial_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"financial_entry_id" uuid NOT NULL,
	"financial_account_id" uuid,
	"amount_cents" integer NOT NULL,
	"fee_amount_cents" integer DEFAULT 0 NOT NULL,
	"payment_method" text,
	"settled_at" timestamp with time zone NOT NULL,
	"note" text,
	"reversed_at" timestamp with time zone,
	"reversal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_settlements_amount_positive" CHECK ("financial_settlements"."amount_cents" > 0),
	CONSTRAINT "financial_settlements_fee_nonnegative" CHECK ("financial_settlements"."fee_amount_cents" >= 0 and "financial_settlements"."fee_amount_cents" <= "financial_settlements"."amount_cents")
);--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"calculated_closing_cents" integer,
	"declared_closing_cents" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_financial_entry_id_financial_entries_id_fk" FOREIGN KEY ("financial_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_workshop_name_unique" ON "financial_accounts" USING btree ("workshop_id","name");--> statement-breakpoint
CREATE INDEX "financial_accounts_workshop_idx" ON "financial_accounts" USING btree ("workshop_id","active");--> statement-breakpoint
CREATE INDEX "suppliers_workshop_name_idx" ON "suppliers" USING btree ("workshop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_workshop_document_unique" ON "suppliers" USING btree ("workshop_id","document") WHERE "suppliers"."document" is not null;--> statement-breakpoint
CREATE INDEX "financial_entries_due_status_idx" ON "financial_entries" USING btree ("workshop_id","direction","status","due_date");--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_installment_positive" CHECK ("financial_entries"."installment_number" > 0 and "financial_entries"."installment_count" > 0 and "financial_entries"."installment_number" <= "financial_entries"."installment_count");--> statement-breakpoint
CREATE INDEX "financial_settlements_entry_idx" ON "financial_settlements" USING btree ("workshop_id","financial_entry_id","settled_at");--> statement-breakpoint
CREATE INDEX "financial_settlements_account_idx" ON "financial_settlements" USING btree ("workshop_id","financial_account_id","settled_at");--> statement-breakpoint
CREATE INDEX "cash_sessions_account_opened_idx" ON "cash_sessions" USING btree ("workshop_id","financial_account_id","opened_at");
