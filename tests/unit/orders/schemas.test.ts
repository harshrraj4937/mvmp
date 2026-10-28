import { describe, expect, test } from "vitest";

import {
  addressPatchSchema,
  addressSchema,
  merchantCancelSchema,
  merchantOrderListQuerySchema,
  merchantStatusSchema,
  placeOrderSchema,
  shopperCancelSchema,
} from "~/modules/orders/presentation/schemas";

const address = {
  city: "Panaji",
  fullName: "Asha Naik",
  line1: "12 Fontainhas Road",
  phone: "98765 43210",
  postalCode: "403 001",
  state: "goa",
};

const place = {
  addressId: "addr1",
  checkoutKey: "k_0123456789abcdef",
  expectedTotalPaise: 34900,
  paymentMethod: "COD",
};

describe("address schema", () => {
  test("normalises phone and PIN and treats blanks as absent", () => {
    const parsed = addressSchema.parse({
      ...address,
      landmark: " ",
      line2: "",
    });
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.postalCode).toBe("403001");
    expect(parsed.landmark).toBeUndefined();
    expect(parsed.line2).toBeUndefined();
  });

  test("refuses a bad PIN, an unknown state and a long landmark", () => {
    expect(
      addressSchema.safeParse({ ...address, postalCode: "012345" }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({ ...address, state: "goa-x" }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({ ...address, landmark: "x".repeat(81) }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({ ...address, phone: "12345" }).success,
    ).toBe(false);
  });

  test("a patch needs at least one field", () => {
    expect(addressPatchSchema.safeParse({}).success).toBe(false);
    expect(addressPatchSchema.safeParse({ city: "Margao" }).success).toBe(true);
    expect(addressPatchSchema.safeParse({ isDefault: true }).success).toBe(
      true,
    );
  });
});

describe("order schemas", () => {
  test("place order", () => {
    expect(placeOrderSchema.safeParse(place).success).toBe(true);
    expect(
      placeOrderSchema.safeParse({ ...place, checkoutKey: "short" }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        ...place,
        checkoutKey: "bad key with spaces",
      }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...place, paymentMethod: "CARD" }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...place, expectedTotalPaise: -1 }).success,
    ).toBe(false);
  });

  test("cancel and status", () => {
    expect(merchantCancelSchema.safeParse({ reason: "OTHER" }).success).toBe(
      false,
    );
    expect(
      merchantCancelSchema.safeParse({ note: "Kiln broke", reason: "OTHER" })
        .success,
    ).toBe(true);
    expect(
      merchantCancelSchema.safeParse({ reason: "OUT_OF_STOCK" }).success,
    ).toBe(true);
    expect(shopperCancelSchema.safeParse({}).success).toBe(true);
    expect(
      shopperCancelSchema.safeParse({ merchantOrder: "GIL-1001-B" }).success,
    ).toBe(true);
    expect(
      shopperCancelSchema.safeParse({ merchantOrder: "GIL-1001" }).success,
    ).toBe(false);
    expect(merchantStatusSchema.safeParse({ to: "PACKING" }).success).toBe(
      true,
    );
    expect(
      merchantStatusSchema.safeParse({ to: "HANDED_TO_COURIER" }).success,
    ).toBe(false);
  });
});

test("merchant order list query", () => {
  expect(merchantOrderListQuerySchema.parse({})).toEqual({ page: 1 });
  expect(
    merchantOrderListQuerySchema.parse({ page: "3", status: "PACKING" }),
  ).toEqual({ page: 3, status: "PACKING" });
  expect(merchantOrderListQuerySchema.parse({ status: "" })).toEqual({
    page: 1,
  });
  expect(merchantOrderListQuerySchema.safeParse({ page: "0" }).success).toBe(
    false,
  );
  expect(
    merchantOrderListQuerySchema.safeParse({ status: "SHIPPED" }).success,
  ).toBe(false);
});
