import { eq } from "drizzle-orm";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

import { productImagesTable } from "~/db/schema";
import { imageStorageFor } from "~/modules/catalog/application/image-storage";
import {
  addProductImage,
  deleteProductImage,
  updateProductImage,
} from "~/modules/catalog/application/images";
import {
  createProduct,
  getProduct,
} from "~/modules/catalog/application/products";
import {
  publishProduct,
  unpublishProduct,
} from "~/modules/catalog/application/status";
import { createLocalImageStorage } from "~/modules/catalog/infrastructure/local-image-storage";
import { NotFoundError } from "~/platform/errors";

import { productInput, seedApprovedMerchant } from "../support/catalog";
import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
let dir: string;
let storage: ReturnType<typeof createLocalImageStorage>;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gillu-images-"));
  storage = createLocalImageStorage(dir);
});

afterAll(async () => {
  await close();
  await rm(dir, { force: true, recursive: true });
});

const webp = async () =>
  new Uint8Array(await readFile("tests/fixtures/images/three-by-two.webp"));

async function draftProduct() {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(db, shop, productInput());
  return { product, shop };
}

async function storedFiles(): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

test("uploads a WebP and records size and dimensions", async () => {
  const { product, shop } = await draftProduct();
  const bytes = await webp();
  const image = await addProductImage(db, storage, shop, product.id, {
    alt: "Brass diya on a cloth",
    bytes,
    name: "diya.webp",
  });
  expect(image).toMatchObject({
    alt: "Brass diya on a cloth",
    height: 2,
    sortOrder: 0,
    width: 3,
  });
  expect(image.url).toMatch(
    new RegExp(`^/api/v1/images/${shop.merchantId}/[a-z0-9]+\\.webp$`),
  );
  const [row] = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.id, image.id));
  expect(row).toMatchObject({
    bytes: bytes.byteLength,
    contentType: "image/webp",
  });
  const key = image.url.replace("/api/v1/images/", "");
  expect(new Uint8Array(await readFile(join(dir, key)))).toEqual(bytes);
  expect((await getProduct(db, shop, product.id)).publishBlockers).toEqual([]);
});

test("an image without alt text gets the product name", async () => {
  const { product, shop } = await draftProduct();
  const image = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "x.webp",
  });
  expect(image.alt).toBe(product.name);
});

test("an HTML file named .jpg is refused and nothing is stored", async () => {
  const { product, shop } = await draftProduct();
  const before = await storedFiles();
  await expect(
    addProductImage(db, storage, shop, product.id, {
      bytes: new TextEncoder().encode(
        "<!doctype html><script>alert(1)</script>",
      ),
      name: "photo.jpg",
    }),
  ).rejects.toMatchObject({
    code: "invalid_image",
    message: "Upload a JPEG, PNG or WebP image.",
    status: 400,
  });
  expect(await storedFiles()).toEqual(before);
  expect(
    await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, product.id)),
  ).toEqual([]);
});

test("4 MB + 1 byte is refused", async () => {
  const { product, shop } = await draftProduct();
  const big = new Uint8Array(4 * 1024 * 1024 + 1);
  big.set(await webp());
  await expect(
    addProductImage(db, storage, shop, product.id, {
      bytes: big,
      name: "big.webp",
    }),
  ).rejects.toMatchObject({
    code: "image_too_large",
    message: "Images must be 4 MB or smaller.",
    status: 400,
  });
});

test("the ninth image is refused", async () => {
  const { product, shop } = await draftProduct();
  const bytes = await webp();
  for (let i = 0; i < 8; i += 1) {
    await addProductImage(db, storage, shop, product.id, {
      bytes,
      name: `${i}.webp`,
    });
  }
  const before = await storedFiles();
  await expect(
    addProductImage(db, storage, shop, product.id, { bytes, name: "9.webp" }),
  ).rejects.toMatchObject({
    code: "image_limit",
    message: "A product can have up to 8 images.",
    status: 409,
  });
  expect(await storedFiles()).toEqual(before);
  const images = (await getProduct(db, shop, product.id)).images;
  expect(images.map((image) => image.sortOrder)).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7,
  ]);
});

test("alt text and order can be edited", async () => {
  const { product, shop } = await draftProduct();
  const image = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "a.webp",
  });
  const updated = await updateProductImage(db, shop, image.id, {
    alt: "Close-up",
    sortOrder: 3,
  });
  expect(updated).toMatchObject({ alt: "Close-up", sortOrder: 3 });
});

test("a published product keeps its last image", async () => {
  const { product, shop } = await draftProduct();
  const first = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "only.webp",
  });
  await publishProduct(db, shop, product.id);
  await expect(
    deleteProductImage(db, storage, shop, first.id),
  ).rejects.toMatchObject({ code: "last_image", status: 409 });
  expect((await getProduct(db, shop, product.id)).images).toHaveLength(1);

  // With a second photo, or once unpublished, the image can go.
  const second = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "second.webp",
  });
  await deleteProductImage(db, storage, shop, first.id);
  await unpublishProduct(db, shop, product.id);
  await deleteProductImage(db, storage, shop, second.id);
  expect((await getProduct(db, shop, product.id)).images).toEqual([]);
});

test("deleting removes the row and the file", async () => {
  const { product, shop } = await draftProduct();
  const image = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "d.webp",
  });
  const file = join(dir, image.url.replace("/api/v1/images/", ""));
  await deleteProductImage(db, storage, shop, image.id);
  expect(
    await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.id, image.id)),
  ).toEqual([]);
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
});

test("another shop's image is 404", async () => {
  const { product, shop } = await draftProduct();
  const other = await seedApprovedMerchant(db);
  const image = await addProductImage(db, storage, shop, product.id, {
    bytes: await webp(),
    name: "o.webp",
  });
  await expect(
    addProductImage(db, storage, other, product.id, {
      bytes: await webp(),
      name: "x.webp",
    }),
  ).rejects.toBeInstanceOf(NotFoundError);
  await expect(
    updateProductImage(db, other, image.id, { alt: "Mine now" }),
  ).rejects.toBeInstanceOf(NotFoundError);
  await expect(
    deleteProductImage(db, storage, other, image.id),
  ).rejects.toBeInstanceOf(NotFoundError);
  expect((await getProduct(db, shop, product.id)).images).toHaveLength(1);
});

test("storage is unavailable without an UploadThing token", () => {
  expect(() =>
    imageStorageFor({
      allowLocalInProduction: false,
      driver: "uploadthing",
      localDir: dir,
      production: false,
      uploadthingToken: undefined,
    }),
  ).toThrow(
    expect.objectContaining({ code: "image_storage_unavailable", status: 503 }),
  );
});

test("local storage in production needs the explicit flag", () => {
  const config = {
    allowLocalInProduction: false,
    driver: "local" as const,
    localDir: dir,
    production: true,
    uploadthingToken: undefined,
  };
  expect(() => imageStorageFor(config)).toThrow(
    expect.objectContaining({ code: "image_storage_unavailable" }),
  );
  expect(
    imageStorageFor({ ...config, allowLocalInProduction: true }),
  ).toBeDefined();
});

test("local storage refuses keys that leave its directory", async () => {
  await expect(storage.read("../etc/passwd")).resolves.toBeNull();
  await expect(storage.read("/etc/passwd")).resolves.toBeNull();
});
