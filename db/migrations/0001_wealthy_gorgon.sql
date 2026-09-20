CREATE TABLE "service_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_price_cents" integer DEFAULT 0 NOT NULL,
	"default_return_interval_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_catalog_price_nonnegative" CHECK ("service_catalog"."default_price_cents" >= 0),
	CONSTRAINT "service_catalog_interval_positive" CHECK ("service_catalog"."default_return_interval_days" is null or "service_catalog"."default_return_interval_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "service_catalog_id" uuid;--> statement-breakpoint
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_catalog_workshop_name_idx" ON "service_catalog" USING btree ("workshop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_workshop_name_unique" ON "service_catalog" USING btree ("workshop_id","name");--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_service_catalog_id_service_catalog_id_fk" FOREIGN KEY ("service_catalog_id") REFERENCES "public"."service_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_catalog_idx" ON "service_records" USING btree ("workshop_id","service_catalog_id");