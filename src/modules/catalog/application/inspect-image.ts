import { imageSize } from "image-size";

import { AppError } from "~/platform/errors";

import type { ImageStorage } from "./image-storage";

import { MAX_IMAGE_BYTES } from "../domain/constants";
import {
  detectImageType,
  type ImageContentType,
} from "../infrastructure/image-type";

const invalidImage = () =>
  new AppError("invalid_image", "Upload a JPEG, PNG or WebP image.", 400);

/** Deletes a stored file; a failure is only logged (the row is gone already). */
export async function deleteStoredImage(
  storage: ImageStorage,
  key: string,
): Promise<void> {
  try {
    await storage.delete(key);
  } catch (error) {
    // Imported here: the logger reads server env, which services avoid.
    const { logger } = await import("~/platform/logger");
    logger.warn({ err: error, key }, "Could not delete a stored image.");
  }
}

/**
 * Checks uploaded bytes before anything is stored: at most 4 MB, a JPEG,
 * PNG or WebP by its magic bytes (never the file name), with readable
 * dimensions.
 */
export function inspectImage(bytes: Uint8Array): {
  contentType: ImageContentType;
  height: number;
  width: number;
} {
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AppError(
      "image_too_large",
      "Images must be 4 MB or smaller.",
      400,
    );
  }
  const contentType = detectImageType(bytes);
  if (!contentType) {
    throw invalidImage();
  }
  try {
    const { height, width } = imageSize(bytes);
    return { contentType, height, width };
  } catch {
    throw invalidImage();
  }
}
