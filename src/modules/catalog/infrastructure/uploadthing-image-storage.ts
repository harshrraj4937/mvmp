import { UTApi } from "uploadthing/server";

import type { ImageStorage } from "../application/image-storage";

import { IMAGE_EXTENSIONS } from "./image-type";

/** Images on UploadThing; the public URL is the file's ufsUrl. */
export function createUploadThingImageStorage(token: string): ImageStorage {
  const api = new UTApi({ token });
  return {
    async delete(key) {
      await api.deleteFiles(key);
    },

    async put({ bytes, contentType, folder }) {
      const file = new File(
        // Copy into a plain ArrayBuffer-backed array for the File constructor.
        [new Uint8Array(bytes)],
        `${folder}-${Date.now()}.${IMAGE_EXTENSIONS[contentType]}`,
        { type: contentType },
      );
      const result = await api.uploadFiles(file);
      if (result.error) {
        throw new Error(`UploadThing upload failed: ${result.error.code}`);
      }
      return { key: result.data.key, url: result.data.ufsUrl };
    },
  };
}
