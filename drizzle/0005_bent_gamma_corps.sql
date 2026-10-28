CREATE TYPE "public"."composition_label" AS ENUM('INGREDIENTS', 'MATERIALS');--> statement-breakpoint
CREATE TYPE "public"."made_how" AS ENUM('HANDMADE', 'HOMEMADE');--> statement-breakpoint
CREATE TABLE "cart_items" (
	"cart_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paise_seen" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variant_id" text NOT NULL,
	CONSTRAINT "cart_items_cart_variant_unique" UNIQUE("cart_id","variant_id"),
	CONSTRAINT "cart_items_quantity_range" CHECK ("cart_items"."quantity" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"guest_token_hash" text,
	"id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	CONSTRAINT "carts_guest_token_hash_unique" UNIQUE("guest_token_hash"),
	CONSTRAINT "carts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "carts_one_owner" CHECK (("carts"."user_id" IS NULL) <> ("carts"."guest_token_hash" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "merchant_story_images" (
	"alt" text NOT NULL,
	"bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"height" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "composition_label" "composition_label" DEFAULT 'INGREDIENTS' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "composition" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "made_by" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "made_how" "made_how";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "origin_place" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "origin_state" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "home_place" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "home_state" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "story" text;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_story_images" ADD CONSTRAINT "merchant_story_images_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "merchant_story_images_merchant_id_idx" ON "merchant_story_images" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_origin_state_idx" ON "products" USING btree ("origin_state");--> statement-breakpoint
CREATE INDEX "products_made_how_idx" ON "products" USING btree ("made_how");--> statement-breakpoint
CREATE INDEX "products_status_published_at_idx" ON "products" USING btree ("status","published_at");--> statement-breakpoint
-- Craft categories describe products by their materials (spec §4.1).
UPDATE "categories" SET "composition_label" = 'MATERIALS' WHERE "slug" IN ('art-and-handicrafts', 'home-and-festive-decor', 'handmade-gifts');
