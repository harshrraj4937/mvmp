/** What stops a product from being published, in the order shown to merchants. */
export type PublishBlocker =
  | "category"
  | "composition"
  | "image"
  | "made_by"
  | "made_how"
  | "origin"
  | "shop_story"
  | "variant";

/**
 * A product can publish when its category exists and is active, it has at
 * least one active variant with a price and at least one image, its story
 * is filled in (origin state and place, maker, handmade or homemade,
 * composition) and its shop's story is complete.
 */
export function publishBlockers(product: {
  activePricedVariants: number;
  categoryActive: boolean | null;
  composition: boolean;
  images: number;
  madeBy: boolean;
  madeHow: boolean;
  origin: boolean;
  shopStoryComplete: boolean;
}): PublishBlocker[] {
  const checks: [PublishBlocker, boolean][] = [
    ["category", product.categoryActive === true],
    ["variant", product.activePricedVariants >= 1],
    ["image", product.images >= 1],
    ["origin", product.origin],
    ["made_by", product.madeBy],
    ["made_how", product.madeHow],
    ["composition", product.composition],
    ["shop_story", product.shopStoryComplete],
  ];
  return checks.filter(([, ok]) => !ok).map(([blocker]) => blocker);
}
