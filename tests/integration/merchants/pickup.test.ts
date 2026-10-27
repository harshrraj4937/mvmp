import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { merchantPickupLocationsTable } from "~/db/schema";
import {
  addPickupLocation,
  listPickupLocations,
  updatePickupLocation,
} from "~/modules/merchants/application/pickup";
import { pickupLocationCreateSchema } from "~/modules/merchants/presentation/schemas";

import { connectTestDb } from "../support/db";
import { seedMerchant } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const secondLocation = (isPrimary?: boolean) =>
  pickupLocationCreateSchema.parse({
    address: {
      city: "Kanchipuram",
      line1: "7 Gandhi Road",
      postalCode: "631 501",
      state: "Tamil Nadu",
    },
    contactName: "Kumar",
    isPrimary,
    label: "Weaving unit",
    phone: "9840012345",
  });

test("lists the onboarding pickup location as primary", async () => {
  const ctx = await seedMerchant(db);
  expect(await listPickupLocations(db, ctx)).toEqual([
    expect.objectContaining({ isPrimary: true, label: "Warehouse" }),
  ]);
});

test("adding a primary location moves the primary flag", async () => {
  const ctx = await seedMerchant(db);
  const added = await addPickupLocation(db, ctx, secondLocation(true));
  expect(added).toMatchObject({ isPrimary: true, postalCode: "631501" });

  const locations = await listPickupLocations(db, ctx);
  expect(locations).toHaveLength(2);
  expect(locations.filter((l) => l.isPrimary)).toEqual([
    expect.objectContaining({ id: added.id }),
  ]);
  expect(locations[0]?.id).toBe(added.id);
});

test("a non-primary location is added without touching the primary", async () => {
  const ctx = await seedMerchant(db);
  const added = await addPickupLocation(db, ctx, secondLocation());
  expect(added.isPrimary).toBe(false);
  expect((await listPickupLocations(db, ctx))[0]?.label).toBe("Warehouse");
});

test("updating a location and making it primary", async () => {
  const ctx = await seedMerchant(db);
  const added = await addPickupLocation(db, ctx, secondLocation());
  const updated = await updatePickupLocation(db, ctx, added.id, {
    contactName: "Kumar S",
    isPrimary: true,
  });
  expect(updated).toMatchObject({ contactName: "Kumar S", isPrimary: true });
  expect(
    (await listPickupLocations(db, ctx)).filter((l) => l.isPrimary),
  ).toHaveLength(1);
});

test("another merchant's location is 404 and stays unchanged", async () => {
  const shopA = await seedMerchant(db);
  const shopB = await seedMerchant(db);
  const [aLocation] = await listPickupLocations(db, shopA);

  await expect(
    updatePickupLocation(db, shopB, aLocation?.id ?? "", { label: "Hijacked" }),
  ).rejects.toMatchObject({ code: "not_found", status: 404 });
  await expect(
    updatePickupLocation(db, shopB, aLocation?.id ?? "", { isPrimary: true }),
  ).rejects.toMatchObject({ status: 404 });

  expect(await listPickupLocations(db, shopA)).toEqual([aLocation]);
  expect(
    (await listPickupLocations(db, shopB)).some((l) => l.id === aLocation?.id),
  ).toBe(false);
});

test("an unknown location id is 404", async () => {
  const ctx = await seedMerchant(db);
  await expect(
    updatePickupLocation(db, ctx, createId(), { label: "Nope" }),
  ).rejects.toMatchObject({ status: 404 });
});

test("the only primary location cannot be unset", async () => {
  const ctx = await seedMerchant(db);
  const [primary] = await listPickupLocations(db, ctx);
  await expect(
    updatePickupLocation(db, ctx, primary?.id ?? "", { isPrimary: false }),
  ).rejects.toMatchObject({ code: "primary_required", status: 409 });
});

test("the database rejects an invalid PIN code", async () => {
  const ctx = await seedMerchant(db);
  await expect(
    db.insert(merchantPickupLocationsTable).values({
      city: "Pune",
      contactName: "X",
      id: createId(),
      label: "Bad",
      line1: "1 Road",
      merchantId: ctx.merchantId,
      phone: "+919876543210",
      postalCode: "012345",
      state: "Maharashtra",
    }),
  ).rejects.toThrow();
  expect(
    await db
      .select()
      .from(merchantPickupLocationsTable)
      .where(eq(merchantPickupLocationsTable.label, "Bad")),
  ).toEqual([]);
});
