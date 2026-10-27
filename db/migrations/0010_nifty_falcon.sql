CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"direction" "financial_direction" NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_categories_workshop_key_unique" ON "financial_categories" USING btree ("workshop_id","key");--> statement-breakpoint
CREATE INDEX "financial_categories_workshop_name_idx" ON "financial_categories" USING btree ("workshop_id","name");