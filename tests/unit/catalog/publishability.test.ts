import { expect, test } from "vitest";

import {
  LOW_STOCK_THRESHOLD,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  STOCK_REASONS,
} from "~/modules/catalog/domain/constants";
import { publishBlockers } from "~/modules/catalog/domain/publishability";

const complete = {
  activePricedVariants: 1,
  categoryActive: true,
  composition: true,
  images: 1,
  madeBy: true,
  madeHow: true,
  origin: true,
  shopStoryComplete: true,
};

test("a product with an active category, a priced variant and an image can publish", () => {
  expect(publishBlockers({ ...complete, activePricedVariants: 1 })).toEqual([]);
});

test("lists every blocker in a fixed order", () => {
  expect(
    publishBlockers({
      activePricedVariants: 0,
      categoryActive: false,
      composition: false,
      images: 0,
      madeBy: false,
      madeHow: false,
      origin: false,
      shopStoryComplete: false,
    }),
  ).toEqual([
    "category",
    "variant",
    "image",
    "origin",
    "made_by",
    "made_how",
    "composition",
    "shop_story",
  ]);
});

test("a missing category blocks publishing", () => {
  expect(publishBlockers({ ...complete, categoryActive: null })).toEqual([
    "category",
  ]);
});

test("catalog limits", () => {
  expect(LOW_STOCK_THRESHOLD).toBe(5);
  expect(STOCK_REASONS).toEqual([
    "INITIAL",
    "RESTOCK",
    "DAMAGED",
    "CORRECTION",
    "OTHER",
  ]);
  expect(MAX_PRODUCT_IMAGES).toBe(8);
  expect(MAX_IMAGE_BYTES).toBe(4 * 1024 * 1024);
});

test("story blockers follow the Phase 3 ones", () => {
  expect(
    publishBlockers({
      ...complete,
      composition: false,
      madeBy: false,
      madeHow: false,
      origin: false,
      shopStoryComplete: false,
    }),
  ).toEqual(["origin", "made_by", "made_how", "composition", "shop_story"]);
});
