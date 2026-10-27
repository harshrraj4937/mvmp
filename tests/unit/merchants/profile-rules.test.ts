import { expect, test } from "vitest";

import {
  canManageProfile,
  lockedFieldsFor,
  PROFILE_FIELDS,
} from "~/modules/merchants/domain/profile-rules";
import { suggestSlug } from "~/modules/merchants/domain/slug";

test("draft and rejected merchants can edit every field", () => {
  expect(lockedFieldsFor("DRAFT").size).toBe(0);
  expect(lockedFieldsFor("REJECTED").size).toBe(0);
});

test("submitted merchants are fully locked", () => {
  expect(lockedFieldsFor("SUBMITTED").size).toBe(PROFILE_FIELDS.length);
});

test("approved and suspended merchants cannot change name, slug or compliance ids", () => {
  for (const status of ["APPROVED", "SUSPENDED"] as const) {
    expect([...lockedFieldsFor(status)].sort()).toEqual([
      "fssaiLicense",
      "gstin",
      "pan",
      "slug",
      "storeName",
    ]);
  }
});

test("only the owner manages the profile", () => {
  expect(canManageProfile("owner")).toBe(true);
  expect(canManageProfile("staff")).toBe(false);
});

test.each([
  ["  Lakshmi's Silk & Saree House!! ", "lakshmis-silk-saree-house"],
  ["Kolhapuri  Chappal--Co", "kolhapuri-chappal-co"],
  ["Ārogya Ayurveda", "arogya-ayurveda"],
])("suggestSlug(%j) → %s", (name, slug) => {
  expect(suggestSlug(name)).toBe(slug);
});
