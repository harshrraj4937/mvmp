import { expect, test } from "vitest";

import {
  LOW_STOCK_THRESHOLD,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  STOCK_REASONS,
} from "~/modules/catalog/domain/constants";
import { publishBlockers } from "~/modules/catalog/domain/publishability";

test("a product with an active category, a priced variant and an image can publish", () => {
  expect(
    publishBlockers({
      activePricedVariants: 1,
      categoryActive: true,
      images: 1,
    }),
  ).toEqual([]);
});

test("lists every blocker in a fixed order", () => {
  expect(
    publishBlockers({
      activePricedVariants: 0,
      categoryActive: false,
      images: 0,
    }),
  ).toEqual(["category", "variant", "image"]);
});

test("a missing category blocks publishing", () => {
  expect(
    publishBlockers({
      activePricedVariants: 1,
      categoryActive: null,
      images: 1,
    }),
  ).toEqual(["category"]);
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
