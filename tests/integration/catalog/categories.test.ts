import { createId } from "@paralleldrive/cuid2";
import { afterAll, describe, expect, test } from "vitest";

import {
  createCategory,
  listActiveCategories,
  listCategories,
  updateCategory,
} from "~/modules/catalog/application/categories";
import { ConflictError, NotFoundError } from "~/platform/errors";

import { testAdmin } from "../../support/merchant-fixtures";
import { seedCategory } from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const admin = async () => testAdmin(await seedUser(db, "admin"));

describe("categories", () => {
  test("lists the seeded active categories in sort order", async () => {
    const names = (await listActiveCategories(db)).map((c) => c.name);
    expect(names.slice(0, 7)).toEqual([
      "Regional packaged food",
      "Snacks and sweets",
      "Cashews and dry fruits",
      "Art and handicrafts",
      "Home and festive decor",
      "Handmade gifts",
      "Other regional products",
    ]);
  });

  test("an admin adds a category with a slug from its name", async () => {
    const name = `Pickles ${createId().slice(0, 6)}`;
    const created = await createCategory(db, await admin(), {
      name,
      sortOrder: 80,
    });
    expect(created).toMatchObject({
      isActive: true,
      name,
      slug: name.toLowerCase().replace(" ", "-"),
      sortOrder: 80,
    });
    expect((await listActiveCategories(db)).map((c) => c.id)).toContain(
      created.id,
    );
  });

  test("a duplicate name, in any case, is refused", async () => {
    const actor = await admin();
    const name = `Jams ${createId().slice(0, 6)}`;
    await createCategory(db, actor, { name });
    await expect(
      createCategory(db, actor, { name: name.toUpperCase() }),
    ).rejects.toMatchObject({ code: "category_exists" });
    await expect(
      createCategory(db, actor, { name: name.toUpperCase() }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("renaming onto another category's name is refused", async () => {
    const actor = await admin();
    const first = await createCategory(db, actor, {
      name: `Spices ${createId().slice(0, 6)}`,
    });
    const second = await createCategory(db, actor, {
      name: `Teas ${createId().slice(0, 6)}`,
    });
    await expect(
      updateCategory(db, actor, second.id, { name: ` ${first.name} ` }),
    ).rejects.toMatchObject({ code: "category_exists" });
  });

  test("deactivating hides a category from merchants but not from admins", async () => {
    const actor = await admin();
    const created = await createCategory(db, actor, {
      name: `Toys ${createId().slice(0, 6)}`,
    });
    const updated = await updateCategory(db, actor, created.id, {
      isActive: false,
    });
    expect(updated.isActive).toBe(false);
    expect((await listActiveCategories(db)).map((c) => c.id)).not.toContain(
      created.id,
    );
    expect((await listCategories(db, actor)).map((c) => c.id)).toContain(
      created.id,
    );
  });

  test("renaming keeps the slug stable", async () => {
    const actor = await admin();
    const created = await createCategory(db, actor, {
      name: `Rugs ${createId().slice(0, 6)}`,
    });
    const renamed = await updateCategory(db, actor, created.id, {
      name: `Durries ${createId().slice(0, 6)}`,
    });
    expect(renamed.slug).toBe(created.slug);
  });

  test("an admin reorders a category", async () => {
    const id = await seedCategory(db);
    const updated = await updateCategory(db, await admin(), id, {
      sortOrder: 15,
    });
    expect(updated.sortOrder).toBe(15);
  });

  test("an unknown id is not found", async () => {
    await expect(
      updateCategory(db, await admin(), "cat_missing", { sortOrder: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
