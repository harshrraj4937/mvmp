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

export { suggestSlug } from "~/lib/slug";
