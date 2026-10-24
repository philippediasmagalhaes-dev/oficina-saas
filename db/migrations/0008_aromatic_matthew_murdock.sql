CREATE TABLE "legacy_import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"entity_type" text NOT NULL,
	"legacy_id" text NOT NULL,
	"target_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"source_hash" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "legacy_import_mappings" ADD CONSTRAINT "legacy_import_mappings_run_id_legacy_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."legacy_import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_import_mappings" ADD CONSTRAINT "legacy_import_mappings_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_import_runs" ADD CONSTRAINT "legacy_import_runs_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_import_mappings_source_unique" ON "legacy_import_mappings" USING btree ("workshop_id","source_system","entity_type","legacy_id");--> statement-breakpoint
CREATE INDEX "legacy_import_mappings_target_idx" ON "legacy_import_mappings" USING btree ("workshop_id","entity_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_import_runs_source_unique" ON "legacy_import_runs" USING btree ("workshop_id","source_system","source_hash");--> statement-breakpoint
CREATE INDEX "legacy_import_runs_workshop_idx" ON "legacy_import_runs" USING btree ("workshop_id","started_at");
