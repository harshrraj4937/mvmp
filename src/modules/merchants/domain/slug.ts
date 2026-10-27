/** Slugs that would collide with Gillu routes or look official. */
export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "api",
  "auth",
  "gillu",
  "merchant",
  "merchants",
  "new",
  "settings",
  "shop",
  "shops",
];

/** A URL-safe shop slug derived from a store name. */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}
