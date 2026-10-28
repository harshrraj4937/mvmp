CREATE TYPE "public"."actor_role" AS ENUM('SHOPPER', 'MERCHANT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_status" AS ENUM('NEW', 'ACKNOWLEDGED', 'PACKING', 'READY_FOR_PICKUP', 'HANDED_TO_COURIER', 'FULFILLED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."maker_cancel_reason" AS ENUM('OUT_OF_STOCK', 'DAMAGED', 'CANNOT_FULFIL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_FULFILLED', 'COMPLETED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('PREPAID', 'COD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('HELD', 'RELEASED', 'WRITTEN_OFF', 'CONSUMED');--> statement-breakpoint
ALTER TYPE "public"."inventory_movement_reason" ADD VALUE 'ORDER_RESERVED';--> statement-breakpoint
ALTER TYPE "public"."inventory_movement_reason" ADD VALUE 'ORDER_RELEASED';--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"city" text NOT NULL,
	"full_name" text NOT NULL,
	"landmark" text,
	"line1" text NOT NULL,
	"line2" text,
	"phone" text NOT NULL,
	"postal_code" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "customer_addresses_postal_code" CHECK ("customer_addresses"."postal_code" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"order_item_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'HELD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variant_id" text NOT NULL,
	CONSTRAINT "inventory_reservations_order_item_id_unique" UNIQUE("order_item_id"),
	CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("inventory_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_orders" (
	"canceled_at" timestamp with time zone,
	"canceled_by" "actor_role",
	"cancel_note" text,
	"cancel_reason" "maker_cancel_reason",
	"cod_amount_paise" bigint,
	"courier_charge_paise" bigint,
	"courier_estimate_paise" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivery_paise" bigint DEFAULT 0 NOT NULL,
	"fulfilment_status" "fulfilment_status" DEFAULT 'NEW' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"items_total_paise" bigint NOT NULL,
	"merchant_id" text NOT NULL,
	"number" text NOT NULL,
	"order_id" text NOT NULL,
	"payment_fee_paise" bigint,
	"total_paise" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "merchant_orders_order_merchant_unique" UNIQUE("order_id","merchant_id"),
	CONSTRAINT "merchant_orders_money_non_negative" CHECK ("merchant_orders"."items_total_paise" >= 0 AND "merchant_orders"."delivery_paise" >= 0 AND "merchant_orders"."total_paise" >= 0
        AND coalesce("merchant_orders"."cod_amount_paise", 0) >= 0
        AND coalesce("merchant_orders"."courier_charge_paise", 0) >= 0
        AND coalesce("merchant_orders"."courier_estimate_paise", 0) >= 0
        AND coalesce("merchant_orders"."payment_fee_paise", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_address_snapshots" (
	"city" text NOT NULL,
	"full_name" text NOT NULL,
	"landmark" text,
	"line1" text NOT NULL,
	"line2" text,
	"phone" text NOT NULL,
	"postal_code" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"cover_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"declared_mrp_paise" bigint,
	"id" text PRIMARY KEY NOT NULL,
	"line_total_paise" bigint NOT NULL,
	"merchant_order_id" text NOT NULL,
	"product_id" text,
	"product_name" text NOT NULL,
	"product_slug" text NOT NULL,
	"quantity" integer NOT NULL,
	"sku" text NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"variant_id" text,
	"variant_label" text,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_money_non_negative" CHECK ("order_items"."unit_price_paise" >= 0 AND "order_items"."line_total_paise" >= 0 AND coalesce("order_items"."declared_mrp_paise", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"actor_role" "actor_role" NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_status" "fulfilment_status",
	"id" text PRIMARY KEY NOT NULL,
	"merchant_order_id" text NOT NULL,
	"note" text,
	"reason" text,
	"to_status" "fulfilment_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"checkout_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivery_paise" bigint DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"items_total_paise" bigint NOT NULL,
	"number" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"status" "order_status" NOT NULL,
	"total_paise" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_user_checkout_key_unique" UNIQUE("user_id","checkout_key"),
	CONSTRAINT "orders_money_non_negative" CHECK ("orders"."items_total_paise" >= 0 AND "orders"."delivery_paise" >= 0 AND "orders"."total_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_address_snapshots" ADD CONSTRAINT "order_address_snapshots_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_order_id_merchant_orders_id_fk" FOREIGN KEY ("merchant_order_id") REFERENCES "public"."merchant_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_merchant_order_id_merchant_orders_id_fk" FOREIGN KEY ("merchant_order_id") REFERENCES "public"."merchant_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_addresses_user_id_idx" ON "customer_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_one_default" ON "customer_addresses" USING btree ("user_id") WHERE "customer_addresses"."is_default";--> statement-breakpoint
CREATE INDEX "inventory_reservations_variant_id_idx" ON "inventory_reservations" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "merchant_orders_merchant_status_idx" ON "merchant_orders" USING btree ("merchant_id","fulfilment_status");--> statement-breakpoint
CREATE INDEX "order_items_merchant_order_id_idx" ON "order_items" USING btree ("merchant_order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_merchant_order_id_idx" ON "order_status_history" USING btree ("merchant_order_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");