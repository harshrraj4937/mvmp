import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { merchantsTable } from "~/db/schema";
import {
  getMerchantProfile,
  submitMerchant,
  updateMerchantProfile,
} from "~/modules/merchants/application/profile";
import {
  approveMerchant,
  rejectMerchant,
} from "~/modules/merchants/application/review";
import { profilePatchSchema } from "~/modules/merchants/presentation/schemas";

import { testAdmin, uniqueSlug } from "../../support/merchant-fixtures";
import { connectTestDb } from "../support/db";
import { seedMerchant, seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const admin = async () => testAdmin(await seedUser(db, "admin"));

test("the owner edits a draft profile, including clearing an optional field", async () => {
  const ctx = await seedMerchant(db);
  const profile = await updateMerchantProfile(
    db,
    ctx,
    profilePatchSchema.parse({
      contactPhone: "098765 11111",
      description: "",
      returnAddress: {
        city: "Mysuru",
        line1: "4 Devaraja Market",
        postalCode: "570001",
        state: "Karnataka",
      },
    }),
  );
  expect(profile).toMatchObject({
    complianceVerified: false,
    contactPhone: "+919876511111",
    description: null,
    returnAddress: { city: "Mysuru", postalCode: "570001" },
    status: "DRAFT",
  });
  expect(await getMerchantProfile(db, ctx)).toEqual(profile);
});

test("staff cannot change the profile", async () => {
  const ctx = await seedMerchant(db);
  await expect(
    updateMerchantProfile(db, { ...ctx, role: "staff" }, { description: "x" }),
  ).rejects.toMatchObject({ code: "forbidden", status: 403 });
});

test("an approved shop cannot change its slug, and nothing is written", async () => {
  const ctx = await seedMerchant(db);
  await submitMerchant(db, ctx);
  await approveMerchant(db, await admin(), ctx.merchantId);

  await expect(
    updateMerchantProfile(db, ctx, {
      description: "New text",
      slug: uniqueSlug(),
    }),
  ).rejects.toMatchObject({
    code: "field_locked",
    details: { fields: ["slug"] },
    status: 409,
  });
  const [row] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.id, ctx.merchantId));
  expect(row).toMatchObject({
    description: "Handwoven Mysore silk sarees.",
    slug: ctx.slug,
  });

  await expect(
    updateMerchantProfile(db, ctx, { description: "New text" }),
  ).resolves.toMatchObject({ description: "New text", status: "APPROVED" });
});

test("a shop under review cannot be edited", async () => {
  const ctx = await seedMerchant(db);
  await submitMerchant(db, ctx);
  await expect(
    updateMerchantProfile(db, ctx, { description: "x" }),
  ).rejects.toMatchObject({ code: "under_review", status: 409 });
});

test("changing the slug to a taken one is slug_taken", async () => {
  const taken = await seedMerchant(db);
  const ctx = await seedMerchant(db);
  await expect(
    updateMerchantProfile(db, ctx, { slug: taken.slug }),
  ).rejects.toMatchObject({ code: "slug_taken", status: 409 });
});

test("submitting moves DRAFT to SUBMITTED once", async () => {
  const ctx = await seedMerchant(db);
  const profile = await submitMerchant(db, ctx);
  expect(profile.status).toBe("SUBMITTED");
  expect(profile.submittedAt).toBeInstanceOf(Date);
  await expect(submitMerchant(db, ctx)).rejects.toMatchObject({
    code: "invalid_transition",
  });
});

test("staff cannot submit the shop", async () => {
  const ctx = await seedMerchant(db);
  await expect(
    submitMerchant(db, { ...ctx, role: "staff" }),
  ).rejects.toMatchObject({ status: 403 });
});

test("resubmitting a rejected shop clears the rejection reason", async () => {
  const ctx = await seedMerchant(db);
  await submitMerchant(db, ctx);
  await rejectMerchant(
    db,
    await admin(),
    ctx.merchantId,
    "Add a return address",
  );
  expect((await getMerchantProfile(db, ctx)).rejectionReason).toBe(
    "Add a return address",
  );

  const profile = await submitMerchant(db, ctx);
  expect(profile).toMatchObject({ rejectionReason: null, status: "SUBMITTED" });
});
