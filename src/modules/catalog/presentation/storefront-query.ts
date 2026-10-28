import { z } from "zod";

import { isStateSlug, type StateSlug } from "../domain/indian-states";

export const STOREFRONT_SORTS = ["newest", "price_asc", "price_desc"] as const;
export interface StorefrontQuery {
  category?: string;
  made?: "handmade" | "homemade";
  page: number;
  q?: string;
  region?: StateSlug;
  sort: StorefrontSort;
}

export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

const CATEGORY_SLUG = /^[a-z0-9-]{1,80}$/;

/** Blank query values count as absent. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      value === undefined || (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    schema.optional(),
  );

/** The public product list's query string. Anything not listed is rejected. */
export const storefrontQuerySchema = z
  .object({
    category: optional(
      z
        .string()
        .trim()
        .regex(CATEGORY_SLUG, "Choose a category from the list."),
    ),
    made: optional(z.enum(["handmade", "homemade"])),
    page: z.preprocess(
      (value) => (value === undefined || value === "" ? 1 : value),
      z.coerce.number().int().min(1, "Page starts at 1."),
    ),
    q: optional(
      z.string().trim().max(100, "Keep the search under 100 characters."),
    ),
    region: optional(
      z
        .string()
        .refine(isStateSlug, "Choose a region from the list.")
        .transform((value) => value as StateSlug),
    ),
    sort: z.preprocess(
      (value) => (value === undefined || value === "" ? "newest" : value),
      z.enum(STOREFRONT_SORTS),
    ),
  })
  .strict();

/**
 * The storefront page's search params, read leniently: a bad value is
 * dropped rather than failing the page. `q` is cut to 100 characters.
 */
export function parseStorefrontSearchParams(
  params: Record<string, string | string[] | undefined>,
): StorefrontQuery {
  const read = (key: string): string => {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first?.trim() ?? "";
  };
  const category = read("category");
  const made = read("made");
  const region = read("region");
  const sort = read("sort");
  const page = Number(read("page"));
  const q = read("q").slice(0, 100);
  return {
    ...(CATEGORY_SLUG.test(category) ? { category } : {}),
    ...(made === "handmade" || made === "homemade" ? { made } : {}),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    ...(q ? { q } : {}),
    ...(isStateSlug(region) ? { region } : {}),
    sort: (STOREFRONT_SORTS as readonly string[]).includes(sort)
      ? (sort as StorefrontSort)
      : "newest",
  };
}
