import { expect, test } from "vitest";

import { normalizeSku } from "~/modules/catalog/domain/sku";

test("trims and uppercases", () => {
  expect(normalizeSku(" kk-kaju_500 ")).toBe("KK-KAJU_500");
});

test("accepts 40 characters", () => {
  expect(normalizeSku("a".repeat(40))).toBe("A".repeat(40));
});

test.each(["", "   ", "has space", "x".repeat(41), "émoji", "SKU/1", "sku.1"])(
  "rejects %j",
  (input) => {
    expect(normalizeSku(input)).toBeNull();
  },
);
