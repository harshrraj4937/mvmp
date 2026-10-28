import { describe, expect, test } from "vitest";

import { isShopStoryComplete } from "~/modules/merchants/domain/story";
import { merchantStoryPatchSchema } from "~/modules/merchants/presentation/schemas";

describe("shop story", () => {
  test("shop story: 150–3000 chars, blank clears, state from list", () => {
    expect(
      merchantStoryPatchSchema.safeParse({ story: "x".repeat(149) }).success,
    ).toBe(false);
    expect(
      merchantStoryPatchSchema.safeParse({ story: "x".repeat(3001) }).success,
    ).toBe(false);
    expect(merchantStoryPatchSchema.parse({ story: " " })).toEqual({
      story: null,
    });
    expect(
      merchantStoryPatchSchema.safeParse({ homeState: "nowhere" }).success,
    ).toBe(false);
    expect(merchantStoryPatchSchema.safeParse({}).success).toBe(false);
    expect(
      merchantStoryPatchSchema.parse({
        homePlace: " Malvan ",
        homeState: "goa",
      }),
    ).toEqual({ homePlace: "Malvan", homeState: "goa" });
  });

  test("story keeps its paragraphs", () => {
    const story = `${"a".repeat(80)}\n\n${"b".repeat(80)}`;
    expect(merchantStoryPatchSchema.parse({ story: ` ${story} ` })).toEqual({
      story,
    });
  });

  test("a shop story is complete with text, place, state and a photo", () => {
    const full = {
      homePlace: "Malvan",
      homeState: "maharashtra",
      images: 1,
      story: "x".repeat(150),
    };
    expect(isShopStoryComplete(full)).toBe(true);
    expect(isShopStoryComplete({ ...full, images: 0 })).toBe(false);
    expect(isShopStoryComplete({ ...full, story: null })).toBe(false);
    expect(isShopStoryComplete({ ...full, homePlace: null })).toBe(false);
    expect(isShopStoryComplete({ ...full, homeState: null })).toBe(false);
  });
});
