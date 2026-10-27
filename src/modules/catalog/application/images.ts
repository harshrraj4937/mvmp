import { createId } from "@paralleldrive/cuid2";
import { and, count, eq, max } from "drizzle-orm";
import { imageSize } from "image-size";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import { productImagesTable, productsTable } from "~/db/schema";
import { AppError, ConflictError, NotFoundError } from "~/platform/errors";

import type { ImagePatch } from "../presentation/schemas";
import type { ImageStorage } from "./image-storage";
import type { ProductImageView } from "./products";

import { MAX_IMAGE_BYTES, MAX_PRODUCT_IMAGES } from "../domain/constants";
import { detectImageType } from "../infrastructure/image-type";
import { archivedProduct, type Executor, loadOwnedProduct } from "./shared";

const imageColumns = {
  alt: productImagesTable.alt,
  height: productImagesTable.height,
  id: productImagesTable.id,
  sortOrder: productImagesTable.sortOrder,
  url: productImagesTable.url,
  width: productImagesTable.width,
};

const imageNotFound = () => new NotFoundError("Image not found.");
const invalidImage = () =>
  new AppError("invalid_image", "Upload a JPEG, PNG or WebP image.", 400);

/**
 * Checks the bytes (type by magic bytes, size, dimensions), stores them and
 * records the image. The file is written first and removed again when the
 * row cannot be inserted, so no row ever points at a missing file.
 */
export async function addProductImage(
  db: Database,
  storage: ImageStorage,
  ctx: MerchantContext,
  productId: string,
  upload: { alt?: string; bytes: Uint8Array; name: string },
): Promise<ProductImageView> {
  const product = await loadOwnedProduct(db, ctx, productId);
  if (product.status === "ARCHIVED") {
    throw archivedProduct();
  }
  if (upload.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AppError(
      "image_too_large",
      "Images must be 4 MB or smaller.",
      400,
    );
  }
  const contentType = detectImageType(upload.bytes);
  if (!contentType) {
    throw invalidImage();
  }
  let size: { height: number; width: number };
  try {
    size = imageSize(upload.bytes);
  } catch {
    throw invalidImage();
  }
  await assertRoomForImage(db, productId);

  const stored = await storage.put({
    bytes: upload.bytes,
    contentType,
    folder: ctx.merchantId,
    name: upload.name,
  });
  try {
    return await db.transaction(async (tx) => {
      // Lock the product so two uploads cannot both take the eighth slot.
      await loadOwnedProduct(tx, ctx, productId, { lock: true });
      const [current] = await tx
        .select({ images: count(), last: max(productImagesTable.sortOrder) })
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, productId));
      if ((current?.images ?? 0) >= MAX_PRODUCT_IMAGES) {
        throw imageLimit();
      }
      const [row] = await tx
        .insert(productImagesTable)
        .values({
          alt: upload.alt?.trim() || product.name,
          bytes: upload.bytes.byteLength,
          contentType,
          height: size.height,
          id: createId(),
          productId,
          sortOrder: current?.images ? (current.last ?? 0) + 1 : 0,
          storageKey: stored.key,
          url: stored.url,
          width: size.width,
        })
        .returning(imageColumns);
      if (!row) {
        throw new Error("Image insert returned no row.");
      }
      return row;
    });
  } catch (error) {
    await deleteQuietly(storage, stored.key);
    throw error;
  }
}

/** Removes the image row, then its file (a leftover file is only logged). */
export async function deleteProductImage(
  db: Database,
  storage: ImageStorage,
  ctx: MerchantContext,
  imageId: string,
): Promise<void> {
  const image = await db.transaction(async (tx) => {
    const owned = await loadOwnedImage(tx, ctx, imageId);
    // Locked so a publish (which checks for an image) and this delete see
    // the same photos: a published product never ends up without one.
    const product = await loadOwnedProduct(tx, ctx, owned.productId, {
      lock: true,
    });
    if (product.status === "PUBLISHED") {
      const [current] = await tx
        .select({ images: count() })
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, owned.productId));
      if ((current?.images ?? 0) <= 1) {
        throw new ConflictError(
          "last_image",
          "A published product needs a photo. Upload another one first, or unpublish the product.",
        );
      }
    }
    await tx
      .delete(productImagesTable)
      .where(eq(productImagesTable.id, owned.id));
    return owned;
  });
  await deleteQuietly(storage, image.storageKey);
}

export async function updateProductImage(
  db: Database,
  ctx: MerchantContext,
  imageId: string,
  patch: ImagePatch,
): Promise<ProductImageView> {
  const image = await loadOwnedImage(db, ctx, imageId);
  if (image.productStatus === "ARCHIVED") {
    throw archivedProduct();
  }
  const [row] = await db
    .update(productImagesTable)
    .set(patch)
    .where(eq(productImagesTable.id, image.id))
    .returning(imageColumns);
  if (!row) {
    throw imageNotFound();
  }
  return row;
}

async function assertRoomForImage(db: Database, productId: string) {
  const [current] = await db
    .select({ images: count() })
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, productId));
  if ((current?.images ?? 0) >= MAX_PRODUCT_IMAGES) {
    throw imageLimit();
  }
}

async function deleteQuietly(storage: ImageStorage, key: string) {
  try {
    await storage.delete(key);
  } catch (error) {
    // Imported here: the logger reads server env, which services avoid.
    const { logger } = await import("~/platform/logger");
    logger.warn({ err: error, key }, "Could not delete a stored image.");
  }
}

function imageLimit() {
  return new ConflictError(
    "image_limit",
    `A product can have up to ${MAX_PRODUCT_IMAGES} images.`,
  );
}

async function loadOwnedImage(
  db: Executor,
  ctx: MerchantContext,
  imageId: string,
) {
  const [image] = await db
    .select({
      id: productImagesTable.id,
      productId: productImagesTable.productId,
      productStatus: productsTable.status,
      storageKey: productImagesTable.storageKey,
    })
    .from(productImagesTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, productImagesTable.productId),
    )
    .where(
      and(
        eq(productImagesTable.id, imageId),
        eq(productsTable.merchantId, ctx.merchantId),
      ),
    );
  if (!image) {
    throw imageNotFound();
  }
  return image;
}
