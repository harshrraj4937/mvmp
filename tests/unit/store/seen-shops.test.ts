import { describe, expect, test } from "vitest";

import {
  parseSeenShops,
  SEEN_SHOPS_COOKIE,
  withSeenShop,
} from "~/ui/gillu/store/seen-shops";

describe("parseSeenShops", () => {
  test("reads comma-separated slugs and drops anything not slug-shaped", () => {
    expect(parseSeenShops("shop-a,<script>,shop_b,,shop-c,UPPER")).toEqual([
      "shop-a",
      "shop-c",
    ]);
  });

  test("an absent cookie is an empty list", () => {
    expect(parseSeenShops(undefined)).toEqual([]);
    expect(parseSeenShops("")).toEqual([]);
  });

  test("keeps the 50 most recent, last one last", () => {
    const value = Array.from({ length: 60 }, (_, i) => `shop-${i}`).join(",");
    const parsed = parseSeenShops(value);
    expect(parsed).toHaveLength(50);
    expect(parsed[0]).toBe("shop-10");
    expect(parsed.at(-1)).toBe("shop-59");
  });

  test("a repeated slug keeps its latest position", () => {
    expect(parseSeenShops("shop-a,shop-b,shop-a")).toEqual([
      "shop-b",
      "shop-a",
    ]);
  });
});

describe("withSeenShop", () => {
  test("appends a new shop", () => {
    expect(withSeenShop(["shop-a"], "shop-b")).toEqual(["shop-a", "shop-b"]);
  });

  test("moves a repeat to the end without duplicating it", () => {
    expect(withSeenShop(["shop-a", "shop-b"], "shop-a")).toEqual([
      "shop-b",
      "shop-a",
    ]);
  });

  test("drops the oldest once the list passes 50", () => {
    const full = Array.from({ length: 50 }, (_, i) => `shop-${i}`);
    const next = withSeenShop(full, "shop-new");
    expect(next).toHaveLength(50);
    expect(next[0]).toBe("shop-1");
    expect(next.at(-1)).toBe("shop-new");
  });

  test("ignores a slug that is not slug-shaped", () => {
    expect(withSeenShop(["shop-a"], "<b>")).toEqual(["shop-a"]);
  });

  test("the cookie is named gillu_seen_shops", () => {
    expect(SEEN_SHOPS_COOKIE).toBe("gillu_seen_shops");
  });
});
