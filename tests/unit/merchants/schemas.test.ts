import { describe, expect, test } from "vitest";

import {
  onboardingSchema,
  postalAddressSchema,
  profilePatchSchema,
  rejectSchema,
} from "~/modules/merchants/presentation/schemas";

import { validOnboarding } from "../../support/merchant-fixtures";

const phone = onboardingSchema.shape.contactPhone;
const slug = onboardingSchema.shape.slug;

describe("onboarding input", () => {
  test("accepts the fixture and normalizes it", () => {
    const result = onboardingSchema.parse(
      validOnboarding({ slug: "Lakshmi-Silks" }),
    );
    expect(result).toMatchObject({
      businessAddress: { postalCode: "560001" },
      contactPhone: "+919876543210",
      pickup: { label: "Warehouse", phone: "+919876543210" },
      slug: "lakshmi-silks",
    });
  });

  test.each([
    "+91 98765 43210",
    "098765-43210",
    "9876543210",
    "(91) 98765 43210",
  ])("phone %s → +919876543210", (value) => {
    expect(phone.parse(value)).toBe("+919876543210");
  });

  test.each(["12345", "5876543210", "+1 2025550123", "98765432101"])(
    "phone %s rejected",
    (value) => {
      expect(phone.safeParse(value).success).toBe(false);
    },
  );

  test("postal code with spaces is normalized; leading zero rejected", () => {
    expect(postalAddressSchema.shape.postalCode.parse("560 001")).toBe(
      "560001",
    );
    expect(
      postalAddressSchema.shape.postalCode.safeParse("060001").success,
    ).toBe(false);
    expect(
      postalAddressSchema.shape.postalCode.safeParse("56001").success,
    ).toBe(false);
  });

  test("GSTIN and PAN are uppercased; empty compliance fields mean absent", () => {
    const result = onboardingSchema.parse(
      validOnboarding({
        fssaiLicense: "",
        gstin: "29abcde1234f1z5",
        pan: "abcde1234f",
      }),
    );
    expect([result.gstin, result.pan, result.fssaiLicense]).toEqual([
      "29ABCDE1234F1Z5",
      "ABCDE1234F",
      undefined,
    ]);
  });

  test.each([
    ["gstin", "29ABCDE1234F1Y5"],
    ["pan", "ABCD1234F"],
    ["fssaiLicense", "1234"],
  ])("invalid %s rejected", (field, value) => {
    expect(
      onboardingSchema.safeParse(validOnboarding({ [field]: value })).success,
    ).toBe(false);
  });

  test.each([
    "ab",
    "Admin",
    "my--shop",
    "-shop",
    "shop-",
    "shop name",
    "a".repeat(51),
  ])("slug %s rejected", (value) => {
    expect(slug.safeParse(value).success).toBe(false);
  });

  test("pickup label defaults to Primary", () => {
    const input = validOnboarding();
    const pickup = Object.fromEntries(
      Object.entries(input.pickup as Record<string, unknown>).filter(
        ([key]) => key !== "label",
      ),
    );
    expect(onboardingSchema.parse({ ...input, pickup }).pickup.label).toBe(
      "Primary",
    );
  });

  test("logo must be an https URL", () => {
    expect(
      onboardingSchema.safeParse(
        validOnboarding({ logoUrl: "http://x.test/a.png" }),
      ).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse(
        validOnboarding({ logoUrl: "https://x.test/a.png" }),
      ).success,
    ).toBe(true);
  });

  test("blank store name is rejected after trimming", () => {
    expect(
      onboardingSchema.safeParse(validOnboarding({ storeName: "   " })).success,
    ).toBe(false);
  });
});

describe("profile patch and review input", () => {
  test("an empty patch is rejected", () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });

  test("a partial patch is accepted and normalized", () => {
    expect(profilePatchSchema.parse({ contactPhone: "98765 43210" })).toEqual({
      contactPhone: "+919876543210",
    });
  });

  test("reject reason needs 5-500 characters", () => {
    expect(rejectSchema.safeParse({ reason: "no" }).success).toBe(false);
    expect(
      rejectSchema.parse({ reason: "  Please add a return address  " }),
    ).toEqual({
      reason: "Please add a return address",
    });
  });
});
