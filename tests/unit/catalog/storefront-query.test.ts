import { describe, expect, test } from "vitest";

import { storyExcerpt } from "~/modules/catalog/application/storefront";
import {
  parseStorefrontSearchParams,
  storefrontQuerySchema,
} from "~/modules/catalog/presentation/storefront-query";

describe("parseStorefrontSearchParams", () => {
  test("drops invalid values and cuts q to 100 characters", () => {
    expect(
      parseStorefrontSearchParams({
        page: "-3",
        q: "x".repeat(500),
        region: "atlantis",
        sort: "drop",
      }),
    ).toEqual({ page: 1, q: "x".repeat(100), sort: "newest" });
  });

  test("keeps valid filters and reads the first of repeated values", () => {
    expect(
      parseStorefrontSearchParams({
        category: ["snacks-and-sweets", "other"],
        made: "handmade",
        page: "3",
        region: "goa",
        sort: "price_desc",
      }),
    ).toEqual({
      category: "snacks-and-sweets",
      made: "handmade",
      page: 3,
      region: "goa",
      sort: "price_desc",
    });
  });
});

describe("storefrontQuerySchema (API)", () => {
  test("rejects page 0 and unknown parameters", () => {
    expect(storefrontQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(storefrontQuerySchema.safeParse({ utm: "x" }).success).toBe(false);
  });

  test("applies defaults for blank values", () => {
    expect(
      storefrontQuerySchema.parse({ page: "", q: "  ", sort: "" }),
    ).toEqual({ page: 1, sort: "newest" });
  });
});

describe("storyExcerpt", () => {
  test("keeps short stories whole", () => {
    expect(storyExcerpt("Short story.")).toBe("Short story.");
  });

  test("cuts long stories at a word boundary", () => {
    const story = "word ".repeat(100).trim();
    const excerpt = storyExcerpt(story);
    expect(excerpt.endsWith("word…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(241);
  });
});
