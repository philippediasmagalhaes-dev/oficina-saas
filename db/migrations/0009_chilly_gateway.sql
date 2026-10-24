ALTER TABLE "service_records" ADD COLUMN "intake_at" timestamp with time zone;--> statement-breakpoint
UPDATE "service_records" SET "intake_at" = "created_at";
