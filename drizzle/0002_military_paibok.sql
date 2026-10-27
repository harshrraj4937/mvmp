CREATE TYPE "public"."merchant_member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "merchant_members" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"role" "merchant_member_role" NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "merchant_members_merchant_user_unique" UNIQUE("merchant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_pickup_locations" (
	"city" text NOT NULL,
	"contact_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"label" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"merchant_id" text NOT NULL,
	"phone" text NOT NULL,
	"postal_code" text NOT NULL,
	"provider_location_name" text,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_pickup_locations_postal_code_check" CHECK ("merchant_pickup_locations"."postal_code" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"business_address" jsonb NOT NULL,
	"compliance_notes" text,
	"compliance_verified_at" timestamp with time zone,
	"contact_email" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"fssai_license" text,
	"gstin" text,
	"id" text PRIMARY KEY NOT NULL,
	"logo_url" text,
	"pan" text,
	"rejection_reason" text,
	"return_address" jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"slug" text NOT NULL,
	"status" "merchant_status" DEFAULT 'DRAFT' NOT NULL,
	"store_name" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_pickup_locations" ADD CONSTRAINT "merchant_pickup_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_members_user_id_idx" ON "merchant_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_members_one_owned_per_user" ON "merchant_members" USING btree ("user_id") WHERE "merchant_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "merchant_pickup_locations_merchant_id_idx" ON "merchant_pickup_locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_pickup_locations_one_primary" ON "merchant_pickup_locations" USING btree ("merchant_id") WHERE "merchant_pickup_locations"."is_primary";--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");