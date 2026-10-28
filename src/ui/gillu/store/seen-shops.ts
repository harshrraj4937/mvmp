/** Shops the shopper has visited: comma-separated slugs, most recent last. */
export const SEEN_SHOPS_COOKIE = "gillu_seen_shops";

const MAX_SEEN = 50;
const SHOP_SLUG = /^[a-z0-9-]{1,80}$/;

/** The cookie's shop list. Entries that are not slug-shaped are dropped. */
export function parseSeenShops(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  const slugs = value.split(",").filter((slug) => SHOP_SLUG.test(slug));
  const latest = slugs.filter(
    (slug, index) => !slugs.includes(slug, index + 1),
  );
  return latest.slice(-MAX_SEEN);
}

/** The list with `slug` moved to the end, capped at 50 (oldest dropped). */
export function withSeenShop(list: string[], slug: string): string[] {
  if (!SHOP_SLUG.test(slug)) {
    return list;
  }
  return [...list.filter((item) => item !== slug), slug].slice(-MAX_SEEN);
}
