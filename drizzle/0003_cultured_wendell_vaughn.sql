CREATE TYPE "public"."inventory_movement_reason" AS ENUM('INITIAL', 'RESTOCK', 'DAMAGED', 'CORRECTION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "categories" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"actor_user_id" text,
	"available_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delta" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"note" text,
	"reason" "inventory_movement_reason" NOT NULL,
	"variant_id" text NOT NULL,
	CONSTRAINT "inventory_movements_delta_nonzero" CHECK ("inventory_movements"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variant_id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "inventory_available_nonnegative" CHECK ("inventory"."available" >= 0),
	CONSTRAINT "inventory_reserved_nonnegative" CHECK ("inventory"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"alt" text NOT NULL,
	"bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"height" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"declared_mrp_paise" bigint,
	"height_mm" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"label" text,
	"length_mm" integer NOT NULL,
	"merchant_id" text NOT NULL,
	"price_paise" bigint NOT NULL,
	"product_id" text NOT NULL,
	"seller_base_price_paise" bigint,
	"sku" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight_grams" integer NOT NULL,
	"width_mm" integer NOT NULL,
	CONSTRAINT "product_variants_merchant_sku_unique" UNIQUE("merchant_id","sku"),
	CONSTRAINT "product_variants_price_positive" CHECK ("product_variants"."price_paise" > 0),
	CONSTRAINT "product_variants_mrp_gte_price" CHECK ("product_variants"."declared_mrp_paise" IS NULL OR "product_variants"."declared_mrp_paise" >= "product_variants"."price_paise"),
	CONSTRAINT "product_variants_weight_positive" CHECK ("product_variants"."weight_grams" > 0),
	CONSTRAINT "product_variants_dimensions_positive" CHECK ("product_variants"."length_mm" > 0 AND "product_variants"."width_mm" > 0 AND "product_variants"."height_mm" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"admin_hold_at" timestamp with time zone,
	"admin_hold_by" text,
	"admin_hold_reason" text,
	"category_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"name" text NOT NULL,
	"published_at" timestamp with time zone,
	"slug" text NOT NULL,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_merchant_slug_unique" UNIQUE("merchant_id","slug"),
	CONSTRAINT "products_currency_inr" CHECK ("products"."currency" = 'INR')
);
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_admin_hold_by_user_id_fk" FOREIGN KEY ("admin_hold_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_movements_variant_id_idx" ON "inventory_movements" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_merchant_status_idx" ON "products" USING btree ("merchant_id","status");