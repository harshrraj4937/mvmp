import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

import { createProduct } from "~/modules/catalog/application/products";
import { publishProduct } from "~/modules/catalog/application/status";
import { createLocalImageStorage } from "~/modules/catalog/infrastructure/local-image-storage";
import {
  addStoryImage,
  deleteStoryImage,
  getMerchantStory,
  updateMerchantStory,
  updateStoryImage,
} from "~/modules/merchants/application/story";
import { merchantStoryPatchSchema } from "~/modules/merchants/presentation/schemas";

import {
  addImageRow,
  productInput,
  seedApprovedMerchant,
} from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedMerchant } from "../support/merchants";

const { close, db } = connectTestDb();
let dir: string;
let storage: ReturnType<typeof createLocalImageStorage>;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gillu-story-"));
  storage = createLocalImageStorage(dir);
});

afterAll(async () => {
  await close();
  await rm(dir, { force: true, recursive: true });
});

const webp = async () =>
  new Uint8Array(await readFile("tests/fixtures/images/three-by-two.webp"));

const STORY = "We roast cashews in our courtyard kitchen in Malvan. ".repeat(4);

const story = (patch: Record<string, unknown>) =>
  merchantStoryPatchSchema.parse(patch);

/** An approved shop with a published product and a story of its own. */
async function sellingShop() {
  const shop = await seedApprovedMerchant(db, {}, { story: false });
  await updateMerchantStory(
    db,
    shop,
    story({ homePlace: "Malvan", homeState: "maharashtra", story: STORY }),
  );
  const photo = await addStoryImage(db, storage, shop, {
    bytes: await webp(),
    name: "kitchen.webp",
  });
  const product = await createProduct(db, shop, productInput());
  await addImageRow(db, product.id);
  await publishProduct(db, shop, product.id);
  return { photo, shop };
}

async function storedFiles(): Promise<number> {
  const folders = await readdir(dir).catch(() => []);
  let total = 0;
  for (const folder of folders) {
    total += (await readdir(join(dir, folder))).length;
  }
  return total;
}

test("a draft shop writes its story and a blank field clears it", async () => {
  const shop = await seedMerchant(db);
  const saved = await updateMerchantStory(
    db,
    shop,
    story({ homePlace: " Malvan ", homeState: "maharashtra", story: STORY }),
  );
  expect(saved).toMatchObject({
    complete: false,
    homePlace: "Malvan",
    homeState: "maharashtra",
    images: [],
    story: STORY.trim(),
  });
  const cleared = await updateMerchantStory(db, shop, story({ homePlace: "" }));
  expect(cleared.homePlace).toBeNull();
});

test("a story is complete once it has a photo; alt defaults to the store name", async () => {
  const shop = await seedMerchant(db);
  await updateMerchantStory(
    db,
    shop,
    story({ homePlace: "Malvan", homeState: "maharashtra", story: STORY }),
  );
  const photo = await addStoryImage(db, storage, shop, {
    bytes: await webp(),
    name: "kitchen.webp",
  });
  expect(photo).toMatchObject({ alt: shop.storeName, height: 2, width: 3 });
  const current = await getMerchantStory(db, shop);
  expect(current.complete).toBe(true);
  expect(current.images.map((image) => image.id)).toEqual([photo.id]);
});

test("a shop can have at most six story photos", async () => {
  const shop = await seedMerchant(db);
  const before = await storedFiles();
  for (let index = 0; index < 6; index += 1) {
    await addStoryImage(db, storage, shop, {
      bytes: await webp(),
      name: `p${index}.webp`,
    });
  }
  await expect(
    addStoryImage(db, storage, shop, { bytes: await webp(), name: "p7.webp" }),
  ).rejects.toMatchObject({ code: "image_limit", status: 409 });
  expect(await storedFiles()).toBe(before + 6);
});

test("two uploads at once cannot both take the sixth slot", async () => {
  const shop = await seedMerchant(db);
  for (let index = 0; index < 5; index += 1) {
    await addStoryImage(db, storage, shop, {
      bytes: await webp(),
      name: `p${index}.webp`,
    });
  }
  const results = await Promise.allSettled([
    addStoryImage(db, storage, shop, { bytes: await webp(), name: "a.webp" }),
    addStoryImage(db, storage, shop, { bytes: await webp(), name: "b.webp" }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect((await getMerchantStory(db, shop)).images).toHaveLength(6);
});

test("a spoofed file is refused and nothing is stored", async () => {
  const shop = await seedMerchant(db);
  const before = await storedFiles();
  await expect(
    addStoryImage(db, storage, shop, {
      bytes: new TextEncoder().encode("<html>hi</html>"),
      name: "x.jpg",
    }),
  ).rejects.toMatchObject({ code: "invalid_image", status: 400 });
  expect(await storedFiles()).toBe(before);
});

test("a selling shop keeps its last story photo", async () => {
  const { photo, shop } = await sellingShop();
  await expect(
    deleteStoryImage(db, storage, shop, photo.id),
  ).rejects.toMatchObject({ code: "last_story_image", status: 409 });

  const second = await addStoryImage(db, storage, shop, {
    bytes: await webp(),
    name: "second.webp",
  });
  await deleteStoryImage(db, storage, shop, photo.id);
  expect((await getMerchantStory(db, shop)).images.map((i) => i.id)).toEqual([
    second.id,
  ]);
});

test("a shop with nothing on sale can remove its last photo", async () => {
  const shop = await seedMerchant(db);
  const photo = await addStoryImage(db, storage, shop, {
    bytes: await webp(),
    name: "only.webp",
  });
  await deleteStoryImage(db, storage, shop, photo.id);
  expect((await getMerchantStory(db, shop)).images).toEqual([]);
});

test("a selling shop's story must stay complete", async () => {
  const { shop } = await sellingShop();
  await expect(
    updateMerchantStory(db, shop, story({ story: "" })),
  ).rejects.toMatchObject({ code: "story_required", status: 409 });
  const changed = await updateMerchantStory(
    db,
    shop,
    story({ homePlace: "Vengurla" }),
  );
  expect(changed.homePlace).toBe("Vengurla");
});

test("photos can be described and reordered", async () => {
  const shop = await seedMerchant(db);
  const photo = await addStoryImage(db, storage, shop, {
    bytes: await webp(),
    name: "a.webp",
  });
  const updated = await updateStoryImage(db, shop, photo.id, {
    alt: "Rolling chikki",
    sortOrder: 4,
  });
  expect(updated).toMatchObject({ alt: "Rolling chikki", sortOrder: 4 });
});

test("another shop's story photo is not found", async () => {
  const owner = await seedMerchant(db);
  const other = await seedMerchant(db);
  const photo = await addStoryImage(db, storage, owner, {
    bytes: await webp(),
    name: "a.webp",
  });
  await expect(
    updateStoryImage(db, other, photo.id, { alt: "Mine now" }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    deleteStoryImage(db, storage, other, photo.id),
  ).rejects.toMatchObject({ status: 404 });
});
