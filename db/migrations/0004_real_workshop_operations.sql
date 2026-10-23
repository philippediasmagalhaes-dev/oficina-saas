CREATE TYPE "public"."compensation_mode" AS ENUM('fixed_monthly', 'fixed_per_service', 'percentage', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."financial_direction" AS ENUM('income', 'expense', 'reserve');--> statement-breakpoint
CREATE TYPE "public"."financial_status" AS ENUM('expected', 'settled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_outbox_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_order_payment_status" AS ENUM('expected', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "business_fin_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"financial_entry_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborator_service_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"service_catalog_id" uuid NOT NULL,
	"fixed_per_service_cents" integer,
	"commission_basis_points" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"compensation_mode" "compensation_mode" NOT NULL,
	"monthly_fixed_cents" integer DEFAULT 0 NOT NULL,
	"fixed_per_service_cents" integer DEFAULT 0 NOT NULL,
	"commission_basis_points" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborators_monthly_nonnegative" CHECK ("collaborators"."monthly_fixed_cents" >= 0),
	CONSTRAINT "collaborators_service_nonnegative" CHECK ("collaborators"."fixed_per_service_cents" >= 0),
	CONSTRAINT "collaborators_commission_range" CHECK ("collaborators"."commission_basis_points" >= 0 and "collaborators"."commission_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "financial_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"financial_entry_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"service_record_id" uuid,
	"payment_id" uuid,
	"collaborator_id" uuid,
	"external_id" text NOT NULL,
	"direction" "financial_direction" NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"fee_amount_cents" integer DEFAULT 0 NOT NULL,
	"net_amount_cents" integer NOT NULL,
	"competence_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"status" "financial_status" DEFAULT 'expected' NOT NULL,
	"recurrence_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_damage_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"vehicle_view" text NOT NULL,
	"x_basis_points" integer NOT NULL,
	"y_basis_points" integer NOT NULL,
	"damage_type" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_damage_x_range" CHECK ("inspection_damage_marks"."x_basis_points" >= 0 and "inspection_damage_marks"."x_basis_points" <= 10000),
	CONSTRAINT "inspection_damage_y_range" CHECK ("inspection_damage_marks"."y_basis_points" >= 0 and "inspection_damage_marks"."y_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"outbox_id" uuid NOT NULL,
	"provider_message_id" text,
	"status" text NOT NULL,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_record_id" uuid,
	"idempotency_key" text NOT NULL,
	"purpose" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"template_name" text,
	"payload" jsonb NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "message_outbox_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"locale" text DEFAULT 'pt_BR' NOT NULL,
	"provider_template_id" text,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"payment_method" text NOT NULL,
	"installment_count" integer DEFAULT 1 NOT NULL,
	"percentage_basis_points" integer DEFAULT 0 NOT NULL,
	"fixed_fee_cents" integer DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_fee_rules_installments_positive" CHECK ("payment_fee_rules"."installment_count" > 0),
	CONSTRAINT "payment_fee_rules_percentage_range" CHECK ("payment_fee_rules"."percentage_basis_points" >= 0 and "payment_fee_rules"."percentage_basis_points" <= 10000),
	CONSTRAINT "payment_fee_rules_fixed_nonnegative" CHECK ("payment_fee_rules"."fixed_fee_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehicle_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"service_record_id" uuid NOT NULL,
	"odometer" integer,
	"fuel_level" text,
	"tire_condition" text,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observations" text,
	"customer_acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_inspections_service_record_id_unique" UNIQUE("service_record_id")
);
--> statement-breakpoint
CREATE TABLE "work_order_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"service_record_id" uuid NOT NULL,
	"quote_version" integer NOT NULL,
	"decision" text NOT NULL,
	"source" text DEFAULT 'public_link' NOT NULL,
	"public_token" uuid NOT NULL,
	"customer_note" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_item_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"work_order_item_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"participation_basis_points" integer DEFAULT 10000 NOT NULL,
	"commission_basis_points_snapshot" integer DEFAULT 0 NOT NULL,
	"fixed_per_service_cents_snapshot" integer DEFAULT 0 NOT NULL,
	"labor_base_cents_snapshot" integer,
	"compensation_cents_snapshot" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_assignment_participation_range" CHECK ("work_order_item_assignments"."participation_basis_points" > 0 and "work_order_item_assignments"."participation_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "work_order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"service_record_id" uuid NOT NULL,
	"payment_method" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"installment_count" integer DEFAULT 1 NOT NULL,
	"paid_at" timestamp with time zone,
	"expected_at" timestamp with time zone NOT NULL,
	"status" "work_order_payment_status" DEFAULT 'expected' NOT NULL,
	"fee_percentage_basis_points" integer DEFAULT 0 NOT NULL,
	"fee_fixed_cents" integer DEFAULT 0 NOT NULL,
	"manual_fee_cents" integer,
	"fee_amount_cents" integer DEFAULT 0 NOT NULL,
	"net_amount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_payment_amount_positive" CHECK ("work_order_payments"."amount_cents" > 0),
	CONSTRAINT "work_order_payment_installments_positive" CHECK ("work_order_payments"."installment_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "work_order_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"service_record_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_financial_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"default_tax_basis_points" integer DEFAULT 0 NOT NULL,
	"default_recognition_mode" text DEFAULT 'cash' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_financial_settings_workshop_id_unique" UNIQUE("workshop_id"),
	CONSTRAINT "workshop_financial_tax_range" CHECK ("workshop_financial_settings"."default_tax_basis_points" >= 0 and "workshop_financial_settings"."default_tax_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "workshop_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_sequences" (
	"workshop_id" uuid PRIMARY KEY NOT NULL,
	"next_work_order_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_sequence_positive" CHECK ("workshop_sequences"."next_work_order_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_street" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_number" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_complement" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_district" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_postal_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "whatsapp_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "whatsapp_consent_source" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "whatsapp_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "reserved_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reservation_delta" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "operation_key" text;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "order_number" integer;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "quote_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "financial_closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "tax_basis_points" integer;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "tax_reserve_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "fee_total_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "net_total_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "plate_normalized" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "category" text DEFAULT 'car' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "manufacture_year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "model_year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "fuel" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "engine_displacement" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "power" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "municipality" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "masked_chassis" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "lookup_provider" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "lookup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "lookup_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD COLUMN "cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD COLUMN "approval_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD COLUMN "completion_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD COLUMN "reservation_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "document" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_street" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_number" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_complement" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_district" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "address_postal_code" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "print_terms" text;--> statement-breakpoint
ALTER TABLE "business_fin_exports" ADD CONSTRAINT "business_fin_exports_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_fin_exports" ADD CONSTRAINT "business_fin_exports_financial_entry_id_financial_entries_id_fk" FOREIGN KEY ("financial_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_service_rates" ADD CONSTRAINT "collaborator_service_rates_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_service_rates" ADD CONSTRAINT "collaborator_service_rates_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_service_rates" ADD CONSTRAINT "collaborator_service_rates_service_catalog_id_service_catalog_id_fk" FOREIGN KEY ("service_catalog_id") REFERENCES "public"."service_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_attachments" ADD CONSTRAINT "financial_attachments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_attachments" ADD CONSTRAINT "financial_attachments_financial_entry_id_financial_entries_id_fk" FOREIGN KEY ("financial_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_payment_id_work_order_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."work_order_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_damage_marks" ADD CONSTRAINT "inspection_damage_marks_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_damage_marks" ADD CONSTRAINT "inspection_damage_marks_inspection_id_vehicle_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."vehicle_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_outbox_id_message_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."message_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ADD CONSTRAINT "payment_fee_rules_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_approvals" ADD CONSTRAINT "work_order_approvals_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_item_assignments" ADD CONSTRAINT "work_order_item_assignments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_item_assignments" ADD CONSTRAINT "work_order_item_assignments_work_order_item_id_work_order_items_id_fk" FOREIGN KEY ("work_order_item_id") REFERENCES "public"."work_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_item_assignments" ADD CONSTRAINT "work_order_item_assignments_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_payments" ADD CONSTRAINT "work_order_payments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_payments" ADD CONSTRAINT "work_order_payments_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_status_events" ADD CONSTRAINT "work_order_status_events_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_status_events" ADD CONSTRAINT "work_order_status_events_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_financial_settings" ADD CONSTRAINT "workshop_financial_settings_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_integrations" ADD CONSTRAINT "workshop_integrations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_sequences" ADD CONSTRAINT "workshop_sequences_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_fin_exports_entry_unique" ON "business_fin_exports" USING btree ("workshop_id","financial_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborator_service_rates_unique" ON "collaborator_service_rates" USING btree ("workshop_id","collaborator_id","service_catalog_id");--> statement-breakpoint
CREATE INDEX "collaborators_workshop_idx" ON "collaborators" USING btree ("workshop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_entries_external_id_unique" ON "financial_entries" USING btree ("workshop_id","external_id");--> statement-breakpoint
CREATE INDEX "financial_entries_period_idx" ON "financial_entries" USING btree ("workshop_id","competence_date","due_date");--> statement-breakpoint
CREATE INDEX "inspection_damage_marks_inspection_idx" ON "inspection_damage_marks" USING btree ("workshop_id","inspection_id");--> statement-breakpoint
CREATE INDEX "message_deliveries_outbox_idx" ON "message_deliveries" USING btree ("workshop_id","outbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_outbox_idempotency_unique" ON "message_outbox" USING btree ("workshop_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "message_outbox_schedule_idx" ON "message_outbox" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_purpose_unique" ON "message_templates" USING btree ("workshop_id","purpose","locale");--> statement-breakpoint
CREATE INDEX "payment_fee_rules_lookup_idx" ON "payment_fee_rules" USING btree ("workshop_id","payment_method","installment_count");--> statement-breakpoint
CREATE INDEX "vehicle_inspections_workshop_idx" ON "vehicle_inspections" USING btree ("workshop_id","service_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_approvals_version_unique" ON "work_order_approvals" USING btree ("service_record_id","quote_version");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_item_assignments_unique" ON "work_order_item_assignments" USING btree ("work_order_item_id","collaborator_id");--> statement-breakpoint
CREATE INDEX "work_order_payments_order_idx" ON "work_order_payments" USING btree ("workshop_id","service_record_id");--> statement-breakpoint
CREATE INDEX "work_order_status_events_order_idx" ON "work_order_status_events" USING btree ("workshop_id","service_record_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_integrations_provider_unique" ON "workshop_integrations" USING btree ("workshop_id","provider");