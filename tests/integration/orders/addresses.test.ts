import { afterAll, describe, expect, test } from "vitest";

import {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  MAX_ADDRESSES,
  updateAddress,
} from "~/modules/orders/application/addresses";
import { addressSchema } from "~/modules/orders/presentation/schemas";

import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const input = (overrides: Record<string, unknown> = {}) =>
  addressSchema.parse({
    city: "Panaji",
    fullName: "Asha Naik",
    line1: "12 Fontainhas Road",
    phone: "9876543210",
    postalCode: "403001",
    state: "goa",
    ...overrides,
  });

describe("shopper addresses", () => {
  test("the first address is the default; a new default moves it", async () => {
    const userId = await seedUser(db);
    const first = await createAddress(db, userId, input());
    expect(first).toMatchObject({
      isDefault: true,
      landmark: null,
      line2: null,
      phone: "+919876543210",
    });
    const second = await createAddress(
      db,
      userId,
      input({ city: "Margao", isDefault: true }),
    );
    const third = await createAddress(db, userId, input({ city: "Vasco" }));
    expect(third.isDefault).toBe(false);
    const listed = await listAddresses(db, userId);
    expect(listed.map((address) => [address.id, address.isDefault])).toEqual([
      [second.id, true],
      [third.id, false],
      [first.id, false],
    ]);
  });

  test("a shopper can keep up to ten addresses", async () => {
    const userId = await seedUser(db);
    for (let i = 0; i < MAX_ADDRESSES; i += 1) {
      await createAddress(db, userId, input());
    }
    await expect(createAddress(db, userId, input())).rejects.toMatchObject({
      code: "address_limit",
      message: "You can save up to 10 addresses.",
      status: 409,
    });
  });

  test("deleting the default makes the newest remaining one default", async () => {
    const userId = await seedUser(db);
    const first = await createAddress(db, userId, input());
    const second = await createAddress(db, userId, input({ city: "Margao" }));
    await createAddress(db, userId, input({ city: "Vasco" }));
    await deleteAddress(db, userId, first.id);
    const listed = await listAddresses(db, userId);
    expect(listed).toHaveLength(2);
    expect(listed[0]).toMatchObject({ city: "Vasco", isDefault: true });
    expect(listed.find((a) => a.id === second.id)?.isDefault).toBe(false);
  });

  test("a patch keeps the fields it does not name", async () => {
    const userId = await seedUser(db);
    const created = await createAddress(
      db,
      userId,
      input({ landmark: "Near the chapel" }),
    );
    const updated = await updateAddress(db, userId, created.id, {
      city: "Old Goa",
    });
    expect(updated).toMatchObject({
      city: "Old Goa",
      fullName: "Asha Naik",
      landmark: "Near the chapel",
    });
    const other = await createAddress(db, userId, input());
    await updateAddress(db, userId, other.id, { isDefault: true });
    expect((await getAddress(db, userId, created.id)).isDefault).toBe(false);
  });

  test("a patch of only isDefault false changes nothing", async () => {
    const userId = await seedUser(db);
    const created = await createAddress(db, userId, input());
    const updated = await updateAddress(db, userId, created.id, {
      isDefault: false,
    });
    expect(updated).toEqual(created);
  });

  test("another shopper's address is not found", async () => {
    const owner = await seedUser(db);
    const stranger = await seedUser(db);
    const created = await createAddress(db, owner, input());
    const notFound = { code: "not_found", status: 404 };
    await expect(getAddress(db, stranger, created.id)).rejects.toMatchObject(
      notFound,
    );
    await expect(
      updateAddress(db, stranger, created.id, { city: "Margao" }),
    ).rejects.toMatchObject(notFound);
    await expect(deleteAddress(db, stranger, created.id)).rejects.toMatchObject(
      notFound,
    );
    expect((await getAddress(db, owner, created.id)).city).toBe("Panaji");
  });
});
