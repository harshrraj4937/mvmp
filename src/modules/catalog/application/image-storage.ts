import { getServerEnv } from "~/platform/env";
import { AppError } from "~/platform/errors";

import type { ImageContentType } from "../infrastructure/image-type";

import { createLocalImageStorage } from "../infrastructure/local-image-storage";
import { createUploadThingImageStorage } from "../infrastructure/uploadthing-image-storage";

/** Where product image bytes live. Keys are opaque to callers. */
export interface ImageStorage {
  delete(key: string): Promise<void>;
  put(file: {
    bytes: Uint8Array;
    contentType: ImageContentType;
    /** Folder for the key: the merchant id. */
    folder: string;
    name: string;
  }): Promise<{ key: string; url: string }>;
}

interface ImageStorageConfig {
  allowLocalInProduction: boolean;
  driver: "local" | "uploadthing";
  localDir: string;
  production: boolean;
  uploadthingToken: string | undefined;
}

const unavailable = () =>
  new AppError(
    "image_storage_unavailable",
    "Image uploads are not configured.",
    503,
  );

/**
 * The image storage for `config`. UploadThing needs its token; local disk
 * storage is for development and E2E unless explicitly allowed in
 * production (files would be lost with the container otherwise).
 */
export function imageStorageFor(config: ImageStorageConfig): ImageStorage {
  if (config.driver === "local") {
    if (config.production && !config.allowLocalInProduction) {
      throw unavailable();
    }
    return createLocalImageStorage(config.localDir);
  }
  if (!config.uploadthingToken) {
    throw unavailable();
  }
  return createUploadThingImageStorage(config.uploadthingToken);
}

/** The local driver's directory, or null when images are not stored locally. */
export function localImageDir(): null | string {
  const env = getServerEnv();
  return env.IMAGE_STORAGE_DRIVER === "local"
    ? env.IMAGE_STORAGE_LOCAL_DIR
    : null;
}
