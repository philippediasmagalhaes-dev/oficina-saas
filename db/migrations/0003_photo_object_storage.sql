ALTER TABLE "service_photos" ALTER COLUMN "data_base64" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_photos" ADD COLUMN "storage_key" text;
--> statement-breakpoint
ALTER TABLE "service_photos" ADD COLUMN "size_bytes" integer;
--> statement-breakpoint
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_size_nonnegative" CHECK ("service_photos"."size_bytes" is null or "service_photos"."size_bytes" >= 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_photos_storage_key_unique" ON "service_photos" USING btree ("storage_key") WHERE "service_photos"."storage_key" is not null;
