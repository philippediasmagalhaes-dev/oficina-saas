ALTER TYPE "public"."message_outbox_status" ADD VALUE IF NOT EXISTS 'processing';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "financial_entry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"financial_entry_id" uuid NOT NULL,
	"from_status" "financial_status" NOT NULL,
	"to_status" "financial_status" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "financial_entry_events" ADD CONSTRAINT "financial_entry_events_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "financial_entry_events" ADD CONSTRAINT "financial_entry_events_financial_entry_id_financial_entries_id_fk" FOREIGN KEY ("financial_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "financial_entry_events_entry_idx" ON "financial_entry_events" USING btree ("workshop_id", "financial_entry_id", "occurred_at");--> statement-breakpoint

UPDATE "customers"
SET "phone_normalized" = CASE
  WHEN length(regexp_replace(coalesce("phone", ''), '\D', '', 'g')) IN (10, 11)
    THEN '55' || regexp_replace(coalesce("phone", ''), '\D', '', 'g')
  ELSE nullif(regexp_replace(coalesce("phone", ''), '\D', '', 'g'), '')
END
WHERE "phone_normalized" IS NULL OR "phone_normalized" = '';--> statement-breakpoint

UPDATE "vehicles"
SET "plate_normalized" = upper(regexp_replace(coalesce("plate", ''), '[^A-Za-z0-9]', '', 'g'))
WHERE "plate_normalized" IS NULL OR "plate_normalized" = '';--> statement-breakpoint

DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT wi."id", wi."workshop_id", wi."service_record_id", wi."inventory_item_id", wi."quantity", sr."quote_version"
    FROM "work_order_items" wi
    JOIN "service_records" sr ON sr."id" = wi."service_record_id" AND sr."workshop_id" = wi."workshop_id"
    WHERE wi."type" = 'part' AND wi."inventory_item_id" IS NOT NULL
      AND wi."reservation_state" IN ('none', 'released') AND sr."status" = 'approved'
  LOOP
    UPDATE "inventory_items"
    SET "reserved_quantity" = "reserved_quantity" + item."quantity", "updated_at" = now()
    WHERE "id" = item."inventory_item_id" AND "workshop_id" = item."workshop_id"
      AND "current_quantity" - "reserved_quantity" >= item."quantity";
    IF FOUND THEN
      INSERT INTO "inventory_movements" ("workshop_id", "inventory_item_id", "service_record_id", "type", "quantity_delta", "reservation_delta", "operation_key", "note")
      VALUES (item."workshop_id", item."inventory_item_id", item."service_record_id", 'adjustment', 0, item."quantity", 'backfill-reserve:' || item."id" || ':v' || item."quote_version", 'Reserva conciliada na migração')
      ON CONFLICT ("workshop_id", "operation_key") DO NOTHING;
      UPDATE "work_order_items" SET "reservation_state" = 'reserved' WHERE "id" = item."id";
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT wi."id", wi."workshop_id", wi."service_record_id", wi."inventory_item_id", wi."quantity", wi."reservation_state", sr."quote_version"
    FROM "work_order_items" wi
    JOIN "service_records" sr ON sr."id" = wi."service_record_id" AND sr."workshop_id" = wi."workshop_id"
    WHERE wi."type" = 'part' AND wi."inventory_item_id" IS NOT NULL
      AND wi."reservation_state" <> 'consumed' AND sr."status" IN ('in_progress', 'ready')
  LOOP
    IF item."reservation_state" = 'reserved' THEN
      UPDATE "inventory_items"
      SET "current_quantity" = "current_quantity" - item."quantity", "reserved_quantity" = "reserved_quantity" - item."quantity", "updated_at" = now()
      WHERE "id" = item."inventory_item_id" AND "workshop_id" = item."workshop_id"
        AND "current_quantity" >= item."quantity" AND "reserved_quantity" >= item."quantity";
    ELSE
      UPDATE "inventory_items"
      SET "current_quantity" = "current_quantity" - item."quantity", "updated_at" = now()
      WHERE "id" = item."inventory_item_id" AND "workshop_id" = item."workshop_id"
        AND "current_quantity" >= item."quantity";
    END IF;
    IF FOUND THEN
      INSERT INTO "inventory_movements" ("workshop_id", "inventory_item_id", "service_record_id", "type", "quantity_delta", "reservation_delta", "operation_key", "note")
      VALUES (item."workshop_id", item."inventory_item_id", item."service_record_id", 'consumption', -item."quantity", CASE WHEN item."reservation_state" = 'reserved' THEN -item."quantity" ELSE 0 END, 'backfill-consume:' || item."id" || ':v' || item."quote_version", 'Consumo conciliado na migração')
      ON CONFLICT ("workshop_id", "operation_key") DO NOTHING;
      UPDATE "work_order_items" SET "reservation_state" = 'consumed', "completion_state" = 'completed' WHERE "id" = item."id";
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

INSERT INTO "work_order_payments" ("workshop_id", "service_record_id", "payment_method", "amount_cents", "installment_count", "paid_at", "expected_at", "status", "fee_amount_cents", "net_amount_cents")
SELECT sr."workshop_id", sr."id", coalesce(nullif(sr."payment_method", ''), 'other'), sr."amount_cents", 1,
  CASE WHEN sr."payment_status" = 'paid' THEN coalesce(sr."delivered_at", sr."completed_at", sr."updated_at") ELSE NULL END,
  coalesce(sr."delivered_at", sr."completed_at", sr."created_at"),
  CASE WHEN sr."payment_status" = 'paid' THEN 'paid'::"work_order_payment_status" ELSE 'expected'::"work_order_payment_status" END,
  coalesce(sr."fee_total_cents", 0), greatest(sr."amount_cents" - coalesce(sr."fee_total_cents", 0), 0)
FROM "service_records" sr
WHERE sr."status" IN ('completed', 'delivered') AND sr."amount_cents" > 0
  AND NOT EXISTS (SELECT 1 FROM "work_order_payments" wp WHERE wp."workshop_id" = sr."workshop_id" AND wp."service_record_id" = sr."id");--> statement-breakpoint

INSERT INTO "financial_entries" ("workshop_id", "service_record_id", "payment_id", "external_id", "direction", "category", "description", "gross_amount_cents", "fee_amount_cents", "net_amount_cents", "competence_date", "due_date", "settled_at", "status")
SELECT wp."workshop_id", wp."service_record_id", wp."id", 'os:' || wp."service_record_id" || ':payment:legacy:' || wp."id", 'income', 'service_income',
  'Recebimento OS ' || coalesce(sr."order_number"::text, ''), wp."amount_cents", wp."fee_amount_cents", wp."net_amount_cents",
  coalesce(sr."completed_at", sr."delivered_at", sr."updated_at"), wp."expected_at", wp."paid_at",
  CASE WHEN wp."status" = 'paid' THEN 'settled'::"financial_status" ELSE 'expected'::"financial_status" END
FROM "work_order_payments" wp
JOIN "service_records" sr ON sr."id" = wp."service_record_id" AND sr."workshop_id" = wp."workshop_id"
WHERE sr."status" IN ('completed', 'delivered')
ON CONFLICT ("workshop_id", "external_id") DO NOTHING;--> statement-breakpoint

UPDATE "service_records" sr
SET "financial_closed_at" = coalesce(sr."financial_closed_at", sr."delivered_at", sr."completed_at", sr."updated_at")
WHERE sr."status" IN ('completed', 'delivered') AND sr."amount_cents" > 0 AND sr."financial_closed_at" IS NULL;
