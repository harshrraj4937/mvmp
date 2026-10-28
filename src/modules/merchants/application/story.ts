import { createId } from "@paralleldrive/cuid2";
import { and, asc, count, eq, max } from "drizzle-orm";

import type { Database } from "~/db";
import type { ImageStorage } from "~/modules/catalog/application/image-storage";
import type { ImagePatch } from "~/modules/catalog/presentation/schemas";

import {
  merchantsTable,
  merchantStoryImagesTable,
  productsTable,
} from "~/db/schema";
import {
  deleteStoredImage,
  inspectImage,
} from "~/modules/catalog/application/inspect-image";
import { MAX_STORY_IMAGES } from "~/modules/catalog/domain/constants";
import { ConflictError, NotFoundError } from "~/platform/errors";

import type { MerchantStoryPatch } from "../presentation/schemas";
import type { MerchantContext } from "./membership";

import { isShopStoryComplete } from "../domain/story";

export interface MerchantStory {
  complete: boolean;
  homePlace: null | string;
  homeState: null | string;
  images: StoryImageView[];
  story: null | string;
}
export interface StoryImageView {
  alt: string;
  height: number;
  id: string;
  sortOrder: number;
  url: string;
  width: number;
}

type Executor = Database | Transaction;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const imageColumns = {
  alt: merchantStoryImagesTable.alt,
  height: merchantStoryImagesTable.height,
  id: merchantStoryImagesTable.id,
  sortOrder: merchantStoryImagesTable.sortOrder,
  url: merchantStoryImagesTable.url,
  width: merchantStoryImagesTable.width,
};

const imageNotFound = () => new NotFoundError("Photo not found.");

/**
 * Stores a story photo (checked like product photos) and records it. The
 * file is written first and removed again when the row cannot be inserted.
 */
export async function addStoryImage(
  db: Database,
  storage: ImageStorage,
  ctx: MerchantContext,
  upload: { alt?: string; bytes: Uint8Array; name: string },
): Promise<StoryImageView> {
  const { contentType, height, width } = inspectImage(upload.bytes);
  if ((await countImages(db, ctx.merchantId)) >= MAX_STORY_IMAGES) {
    throw imageLimit();
  }
  const stored = await storage.put({
    bytes: upload.bytes,
    contentType,
    folder: ctx.merchantId,
    name: upload.name,
  });
  try {
    return await db.transaction(async (tx) => {
      // Locked so two uploads cannot both take the last slot.
      await lockMerchant(tx, ctx.merchantId);
      const [current] = await tx
        .select({
          images: count(),
          last: max(merchantStoryImagesTable.sortOrder),
        })
        .from(merchantStoryImagesTable)
        .where(eq(merchantStoryImagesTable.merchantId, ctx.merchantId));
      if ((current?.images ?? 0) >= MAX_STORY_IMAGES) {
        throw imageLimit();
      }
      const [row] = await tx
        .insert(merchantStoryImagesTable)
        .values({
          alt: upload.alt?.trim() || ctx.storeName,
          bytes: upload.bytes.byteLength,
          contentType,
          height,
          id: createId(),
          merchantId: ctx.merchantId,
          sortOrder: current?.images ? (current.last ?? 0) + 1 : 0,
          storageKey: stored.key,
          url: stored.url,
          width,
        })
        .returning(imageColumns);
      if (!row) {
        throw new Error("Story photo insert returned no row.");
      }
      return row;
    });
  } catch (error) {
    await deleteStoredImage(storage, stored.key);
    throw error;
  }
}

/**
 * Removes a story photo, then its file. A shop with products on sale keeps
 * at least one photo, so its shop page never loses its story.
 */
export async function deleteStoryImage(
  db: Database,
  storage: ImageStorage,
  ctx: MerchantContext,
  imageId: string,
): Promise<void> {
  const image = await db.transaction(async (tx) => {
    await lockMerchant(tx, ctx.merchantId);
    const owned = await loadOwnedImage(tx, ctx, imageId);
    if (
      (await countImages(tx, ctx.merchantId)) <= 1 &&
      (await isSelling(tx, ctx.merchantId))
    ) {
      throw new ConflictError(
        "last_story_image",
        "Your shop has products on sale, so its story needs a photo. Upload another one first.",
      );
    }
    await tx
      .delete(merchantStoryImagesTable)
      .where(eq(merchantStoryImagesTable.id, owned.id));
    return owned;
  });
  await deleteStoredImage(storage, image.storageKey);
}

export async function getMerchantStory(
  db: Executor,
  ctx: MerchantContext,
): Promise<MerchantStory> {
  const [[shop], images] = await Promise.all([
    db
      .select({
        homePlace: merchantsTable.homePlace,
        homeState: merchantsTable.homeState,
        story: merchantsTable.story,
      })
      .from(merchantsTable)
      .where(eq(merchantsTable.id, ctx.merchantId)),
    db
      .select(imageColumns)
      .from(merchantStoryImagesTable)
      .where(eq(merchantStoryImagesTable.merchantId, ctx.merchantId))
      .orderBy(
        asc(merchantStoryImagesTable.sortOrder),
        asc(merchantStoryImagesTable.createdAt),
      ),
  ]);
  if (!shop) {
    throw new NotFoundError("Shop not found.");
  }
  return {
    ...shop,
    complete: isShopStoryComplete({ ...shop, images: images.length }),
    images,
  };
}

/**
 * Saves story fields; a blank clears one. A shop with products on sale
 * cannot make a complete story incomplete. Never needs admin review.
 */
export async function updateMerchantStory(
  db: Database,
  ctx: MerchantContext,
  patch: MerchantStoryPatch,
): Promise<MerchantStory> {
  return db.transaction(async (tx) => {
    await lockMerchant(tx, ctx.merchantId);
    const current = await getMerchantStory(tx, ctx);
    const next = { ...current, ...patch };
    const stillComplete = isShopStoryComplete({
      ...next,
      images: current.images.length,
    });
    if (
      current.complete &&
      !stillComplete &&
      (await isSelling(tx, ctx.merchantId))
    ) {
      throw new ConflictError(
        "story_required",
        "Your shop has products on sale, so its story must stay complete.",
      );
    }
    await tx
      .update(merchantsTable)
      .set(patch)
      .where(eq(merchantsTable.id, ctx.merchantId));
    return getMerchantStory(tx, ctx);
  });
}

export async function updateStoryImage(
  db: Database,
  ctx: MerchantContext,
  imageId: string,
  patch: ImagePatch,
): Promise<StoryImageView> {
  const image = await loadOwnedImage(db, ctx, imageId);
  const [row] = await db
    .update(merchantStoryImagesTable)
    .set(patch)
    .where(eq(merchantStoryImagesTable.id, image.id))
    .returning(imageColumns);
  if (!row) {
    throw imageNotFound();
  }
  return row;
}

async function countImages(db: Executor, merchantId: string) {
  const [current] = await db
    .select({ images: count() })
    .from(merchantStoryImagesTable)
    .where(eq(merchantStoryImagesTable.merchantId, merchantId));
  return current?.images ?? 0;
}

function imageLimit() {
  return new ConflictError(
    "image_limit",
    `A shop can have up to ${MAX_STORY_IMAGES} story photos.`,
  );
}

/** True when the shop has at least one PUBLISHED product. */
async function isSelling(db: Executor, merchantId: string) {
  const [row] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.merchantId, merchantId),
        eq(productsTable.status, "PUBLISHED"),
      ),
    )
    .limit(1);
  return row !== undefined;
}

async function loadOwnedImage(
  db: Executor,
  ctx: MerchantContext,
  imageId: string,
) {
  const [image] = await db
    .select({
      id: merchantStoryImagesTable.id,
      storageKey: merchantStoryImagesTable.storageKey,
    })
    .from(merchantStoryImagesTable)
    .where(
      and(
        eq(merchantStoryImagesTable.id, imageId),
        eq(merchantStoryImagesTable.merchantId, ctx.merchantId),
      ),
    );
  if (!image) {
    throw imageNotFound();
  }
  return image;
}

async function lockMerchant(tx: Transaction, merchantId: string) {
  await tx
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId))
    .for("update");
}
