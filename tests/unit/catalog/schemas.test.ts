import { describe, expect, test } from "vitest";

import {
  imagePatchSchema,
  productCreateSchema,
  productListQuerySchema,
  productPatchSchema,
  stockAdjustmentSchema,
  variantFieldsSchema,
  variantPatchSchema,
} from "~/modules/catalog/presentation/schemas";

const variant = {
  heightMm: "50",
  lengthMm: 100,
  price: "399",
  sku: "kk-1",
  weightGrams: 500,
  widthMm: 100,
};

function issuesAt(
  result: { error?: { issues: { message: string; path: PropertyKey[] }[] } },
  field: string,
) {
  return (result.error?.issues ?? [])
    .filter((issue) => issue.path.join(".") === field)
    .map((issue) => issue.message);
}

describe("variantFieldsSchema", () => {
  test("turns rupee strings into paise and a blank MRP into undefined", () => {
    const parsed = variantFieldsSchema.parse({
      ...variant,
      mrp: " ",
      price: "₹1,299",
    });
    expect(parsed).toMatchObject({
      heightMm: 50,
      mrp: undefined,
      price: 129900,
      sku: "KK-1",
    });
  });

  test("refuses a price above the declared MRP, on the MRP field", () => {
    const result = variantFieldsSchema.safeParse({
      ...variant,
      mrp: "1000",
      price: "1500",
    });
    expect(issuesAt(result, "mrp")).toEqual([
      "Price cannot be higher than the declared MRP.",
    ]);
  });

  test("accepts a price equal to the MRP", () => {
    expect(
      variantFieldsSchema.safeParse({ ...variant, mrp: "399", price: "399" })
        .success,
    ).toBe(true);
  });

  test("refuses a zero price and a bad SKU on their fields", () => {
    const result = variantFieldsSchema.safeParse({
      ...variant,
      price: "0",
      sku: "bad sku",
    });
    expect(issuesAt(result, "price")).toHaveLength(1);
    expect(issuesAt(result, "sku")).toHaveLength(1);
  });

  test("refuses weights and sizes out of range", () => {
    const result = variantFieldsSchema.safeParse({
      ...variant,
      lengthMm: 0,
      weightGrams: 50_001,
    });
    expect(issuesAt(result, "weightGrams")).toHaveLength(1);
    expect(issuesAt(result, "lengthMm")).toHaveLength(1);
  });
});

describe("product schemas", () => {
  test("a new product needs a name, a category, a variant and stock", () => {
    const parsed = productCreateSchema.parse({
      categoryId: "cat_handmade_gifts",
      initialStock: "12",
      name: "  Clay diya set ",
      variant,
    });
    expect(parsed).toMatchObject({ initialStock: 12, name: "Clay diya set" });
    expect(
      productCreateSchema.safeParse({ categoryId: "", name: "x", variant })
        .success,
    ).toBe(false);
  });

  test("a patch must change something", () => {
    expect(productPatchSchema.safeParse({}).success).toBe(false);
    expect(productPatchSchema.parse({ slug: "Diya Set" })).toEqual({
      slug: "diya-set",
    });
  });

  test("a variant patch can clear the MRP", () => {
    expect(variantPatchSchema.parse({ mrp: "" })).toEqual({ mrp: null });
    expect(variantPatchSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
  });
});

describe("stockAdjustmentSchema", () => {
  test("needs a non-zero change and a reason other than INITIAL", () => {
    expect(
      stockAdjustmentSchema.parse({ delta: "-3", reason: "DAMAGED" }),
    ).toEqual({ delta: -3, reason: "DAMAGED" });
    expect(
      stockAdjustmentSchema.safeParse({ delta: 0, reason: "RESTOCK" }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ delta: 5, reason: "INITIAL" }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ delta: 100_001, reason: "RESTOCK" })
        .success,
    ).toBe(false);
  });
});

describe("imagePatchSchema", () => {
  test("trims alt text and accepts an order position", () => {
    expect(
      imagePatchSchema.parse({ alt: "  Lit diya  ", sortOrder: "2" }),
    ).toEqual({
      alt: "Lit diya",
      sortOrder: 2,
    });
  });

  test("refuses empty patches, blank alt text and negative positions", () => {
    expect(imagePatchSchema.safeParse({}).success).toBe(false);
    expect(imagePatchSchema.safeParse({ alt: "   " }).success).toBe(false);
    expect(imagePatchSchema.safeParse({ sortOrder: -1 }).success).toBe(false);
  });

  test("positions are not capped at the image limit (they grow as photos are replaced)", () => {
    expect(imagePatchSchema.parse({ sortOrder: 12 })).toEqual({
      sortOrder: 12,
    });
  });
});

describe("productListQuerySchema", () => {
  test("accepts a known status and a search, ignoring blanks", () => {
    expect(
      productListQuerySchema.parse({ q: " diya ", status: "PUBLISHED" }),
    ).toEqual({
      q: "diya",
      status: "PUBLISHED",
    });
    expect(productListQuerySchema.parse({ q: "", status: "" })).toEqual({});
  });

  test("refuses an unknown status", () => {
    expect(productListQuerySchema.safeParse({ status: "LIVE" }).success).toBe(
      false,
    );
  });
});
