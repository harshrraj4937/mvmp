import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import {
  merchantMembersTable,
  merchantPickupLocationsTable,
  merchantsTable,
} from "~/db/schema";
import { findMerchantForUser } from "~/modules/merchants/application/membership";
import { registerMerchant } from "~/modules/merchants/application/register";

import { uniqueSlug } from "../../support/merchant-fixtures";
import { connectTestDb } from "../support/db";
import { onboarding, seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

test("registration creates a DRAFT merchant, owner membership and primary pickup location", async () => {
  const userId = await seedUser(db);
  const ctx = await registerMerchant(db, { id: userId }, onboarding());

  expect(ctx).toMatchObject({
    role: "owner",
    status: "DRAFT",
    storeName: "Lakshmi Silks",
    userId,
  });
  expect(await findMerchantForUser(db, userId)).toEqual(ctx);

  const [merchant] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.id, ctx.merchantId));
  expect(merchant).toMatchObject({
    businessAddress: { postalCode: "560001" },
    complianceVerifiedAt: null,
    contactPhone: "+919876543210",
  });

  const pickups = await db
    .select()
    .from(merchantPickupLocationsTable)
    .where(eq(merchantPickupLocationsTable.merchantId, ctx.merchantId));
  expect(pickups).toHaveLength(1);
  expect(pickups[0]).toMatchObject({
    isPrimary: true,
    label: "Warehouse",
    phone: "+919876543210",
    postalCode: "560001",
  });
});

test("a taken slug is a 409 slug_taken and leaves nothing behind", async () => {
  const slug = uniqueSlug();
  await registerMerchant(db, { id: await seedUser(db) }, onboarding({ slug }));

  const other = await seedUser(db);
  await expect(
    registerMerchant(db, { id: other }, onboarding({ slug })),
  ).rejects.toMatchObject({ code: "slug_taken", status: 409 });
  expect(await findMerchantForUser(db, other)).toBeNull();
});

test("a user who already owns a shop gets 409 already_merchant_owner", async () => {
  const user = await seedUser(db);
  await registerMerchant(db, { id: user }, onboarding());
  await expect(
    registerMerchant(db, { id: user }, onboarding()),
  ).rejects.toMatchObject({ code: "already_merchant_owner", status: 409 });
});

test("double-submitted onboarding creates exactly one merchant", async () => {
  const user = await seedUser(db);
  // A double click sends the same payload twice, slug included.
  const input = onboarding();
  const results = await Promise.allSettled([
    registerMerchant(db, { id: user }, input),
    registerMerchant(db, { id: user }, input),
  ]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "already_merchant_owner" },
  });
  const memberships = await db
    .select()
    .from(merchantMembersTable)
    .where(eq(merchantMembersTable.userId, user));
  expect(memberships).toHaveLength(1);
});

test("a user with no membership has no merchant", async () => {
  expect(await findMerchantForUser(db, await seedUser(db))).toBeNull();
});

test("membership resolution prefers the owned merchant over staff memberships", async () => {
  const staffUser = await seedUser(db);
  const otherShop = await registerMerchant(
    db,
    { id: await seedUser(db) },
    onboarding({ storeName: "Other Shop" }),
  );
  await db.insert(merchantMembersTable).values({
    id: createId(),
    merchantId: otherShop.merchantId,
    role: "staff",
    userId: staffUser,
  });
  expect(await findMerchantForUser(db, staffUser)).toMatchObject({
    merchantId: otherShop.merchantId,
    role: "staff",
  });

  const owned = await registerMerchant(
    db,
    { id: staffUser },
    onboarding({ storeName: "My Own Shop" }),
  );
  expect(await findMerchantForUser(db, staffUser)).toMatchObject({
    merchantId: owned.merchantId,
    role: "owner",
  });
});
