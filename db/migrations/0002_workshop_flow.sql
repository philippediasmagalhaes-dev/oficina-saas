ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'diagnosis';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "service_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
CREATE TYPE "quote_status" AS ENUM ('draft', 'sent', 'approved', 'rejected');
CREATE TYPE "quote_item_type" AS ENUM ('service', 'part');
CREATE TYPE "service_photo_kind" AS ENUM ('intake', 'diagnosis', 'completion');
--> statement-breakpoint
ALTER TABLE "service_records" ALTER COLUMN "completed_at" DROP NOT NULL;
ALTER TABLE "service_records" ALTER COLUMN "amount_cents" SET DEFAULT 0;
ALTER TABLE "service_records" ADD COLUMN "complaint" text;
ALTER TABLE "service_records" ADD COLUMN "diagnosis" text;
ALTER TABLE "service_records" ADD COLUMN "quote_status" "quote_status" DEFAULT 'draft' NOT NULL;
ALTER TABLE "service_records" ADD COLUMN "quote_token" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE "service_records" ADD COLUMN "quote_discount_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "service_records" ADD COLUMN "quote_valid_until" timestamp with time zone;
ALTER TABLE "service_records" ADD COLUMN "quote_responded_at" timestamp with time zone;
ALTER TABLE "service_records" ADD COLUMN "approved_at" timestamp with time zone;
ALTER TABLE "service_records" ADD COLUMN "ready_at" timestamp with time zone;
ALTER TABLE "service_records" ADD COLUMN "delivered_at" timestamp with time zone;
ALTER TABLE "service_records" ADD COLUMN "payment_method" text;
ALTER TABLE "service_records" ADD COLUMN "payment_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "service_records" ADD COLUMN "warranty_days" integer;
ALTER TABLE "service_records" ADD COLUMN "delivered_odometer" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX "service_records_quote_token_unique" ON "service_records" USING btree ("quote_token");
ALTER TABLE "service_records" ADD CONSTRAINT "services_discount_nonnegative" CHECK ("service_records"."quote_discount_cents" >= 0);
ALTER TABLE "service_records" ADD CONSTRAINT "services_warranty_nonnegative" CHECK ("service_records"."warranty_days" is null or "service_records"."warranty_days" >= 0);
--> statement-breakpoint
CREATE TABLE "work_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_id" uuid NOT NULL,
  "service_record_id" uuid NOT NULL,
  "type" "quote_item_type" NOT NULL,
  "service_catalog_id" uuid,
  "inventory_item_id" uuid,
  "description" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_order_items_quantity_positive" CHECK ("work_order_items"."quantity" > 0),
  CONSTRAINT "work_order_items_price_nonnegative" CHECK ("work_order_items"."unit_price_cents" >= 0)
);
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade;
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade;
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_service_catalog_id_service_catalog_id_fk" FOREIGN KEY ("service_catalog_id") REFERENCES "public"."service_catalog"("id") ON DELETE set null;
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null;
CREATE INDEX "work_order_items_order_idx" ON "work_order_items" USING btree ("workshop_id", "service_record_id");
--> statement-breakpoint
CREATE TABLE "service_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workshop_id" uuid NOT NULL,
  "service_record_id" uuid NOT NULL,
  "kind" "service_photo_kind" NOT NULL,
  "caption" text,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "data_base64" text NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade;
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE cascade;
CREATE INDEX "service_photos_order_idx" ON "service_photos" USING btree ("workshop_id", "service_record_id");
