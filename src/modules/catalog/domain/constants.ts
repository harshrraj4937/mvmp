/** Variants at or below this stock show "Low stock" to the merchant. */
export const LOW_STOCK_THRESHOLD = 5;

/** Why stock changed; recorded on every inventory movement. */
export const STOCK_REASONS = [
  "INITIAL",
  "RESTOCK",
  "DAMAGED",
  "CORRECTION",
  "OTHER",
  "ORDER_RESERVED",
  "ORDER_RELEASED",
] as const;

/** The reasons a merchant may give for a stock adjustment. */
export const MERCHANT_STOCK_REASONS = [
  "RESTOCK",
  "DAMAGED",
  "CORRECTION",
  "OTHER",
] as const;

export const MAX_PRODUCT_IMAGES = 8;

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** How a product is made; exactly one per product. */
export const MADE_HOW = ["HANDMADE", "HOMEMADE"] as const;
export type MadeHow = (typeof MADE_HOW)[number];

/** What a category calls a product's composition. */
export const COMPOSITION_LABELS = ["INGREDIENTS", "MATERIALS"] as const;
export type CompositionLabel = (typeof COMPOSITION_LABELS)[number];

export const MAX_STORY_IMAGES = 6;
