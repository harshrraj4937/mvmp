/** What stops a product from being published, in the order shown to merchants. */
export type PublishBlocker = "category" | "image" | "variant";

/**
 * A product can publish when its category exists and is active, it has at
 * least one active variant with a price, and it has at least one image.
 */
export function publishBlockers(product: {
  activePricedVariants: number;
  categoryActive: boolean | null;
  images: number;
}): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (product.categoryActive !== true) {
    blockers.push("category");
  }
  if (product.activePricedVariants < 1) {
    blockers.push("variant");
  }
  if (product.images < 1) {
    blockers.push("image");
  }
  return blockers;
}
