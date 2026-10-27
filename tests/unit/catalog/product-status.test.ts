import { describe, expect, test } from "vitest";

import {
  assertProductTransition,
  canTransitionProduct,
  PRODUCT_STATUSES,
  type ProductStatus,
  productStatusesAllowedBefore,
} from "~/modules/catalog/domain/product-status";
import { ConflictError } from "~/platform/errors";

const allowed: [ProductStatus, ProductStatus][] = [
  ["DRAFT", "PUBLISHED"],
  ["PUBLISHED", "UNPUBLISHED"],
  ["UNPUBLISHED", "PUBLISHED"],
  ["DRAFT", "ARCHIVED"],
  ["PUBLISHED", "ARCHIVED"],
  ["UNPUBLISHED", "ARCHIVED"],
];

describe("product status transitions", () => {
  test.each(allowed)("%s → %s allowed", (from, to) => {
    expect(canTransitionProduct(from, to)).toBe(true);
    expect(() => {
      assertProductTransition(from, to);
    }).not.toThrow();
  });

  const refused = PRODUCT_STATUSES.flatMap((from) =>
    PRODUCT_STATUSES.map((to): [ProductStatus, ProductStatus] => [from, to]),
  ).filter(([from, to]) => !allowed.some(([f, t]) => f === from && t === to));

  test.each(refused)("%s → %s refused", (from, to) => {
    expect(canTransitionProduct(from, to)).toBe(false);
    expect(() => {
      assertProductTransition(from, to);
    }).toThrow(ConflictError);
  });

  test("archived is final and nothing returns to draft or pending", () => {
    for (const to of PRODUCT_STATUSES) {
      expect(canTransitionProduct("ARCHIVED", to)).toBe(false);
    }
    expect(productStatusesAllowedBefore("DRAFT")).toEqual([]);
    expect(productStatusesAllowedBefore("PENDING_APPROVAL")).toEqual([]);
  });

  test("lists the states a product may be published from", () => {
    expect(productStatusesAllowedBefore("PUBLISHED")).toEqual([
      "DRAFT",
      "UNPUBLISHED",
    ]);
  });

  test("the conflict uses the invalid_transition code", () => {
    expect(() => {
      assertProductTransition("ARCHIVED", "PUBLISHED");
    }).toThrow(expect.objectContaining({ code: "invalid_transition" }));
  });
});
