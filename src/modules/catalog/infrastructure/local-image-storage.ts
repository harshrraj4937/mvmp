import { createId } from "@paralleldrive/cuid2";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import type { ImageStorage } from "../application/image-storage";

import { IMAGE_EXTENSIONS, type ImageContentType } from "./image-type";

const CONTENT_TYPES: Record<string, ImageContentType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Keys look like `<folder>/<cuid2>.<ext>`; nothing else is ever read. */
const KEY_PATTERN = /^[a-z0-9]+\/[a-z0-9]+\.(jpg|png|webp)$/;

/**
 * Images on local disk, served by GET /api/v1/images/<key>. For development,
 * E2E and single-host deployments with a persistent volume. File calls carry
 * turbopackIgnore: the directory is runtime data, not something to trace
 * into the build output.
 */
export function createLocalImageStorage(directory: string) {
  const root = resolve(directory);

  const pathFor = (key: string): null | string => {
    if (!KEY_PATTERN.test(key) || isAbsolute(key)) {
      return null;
    }
    const path = join(root, key);
    const inside = relative(root, path);
    return inside.startsWith("..") || isAbsolute(inside) ? null : path;
  };

  return {
    async delete(key: string): Promise<void> {
      const path = pathFor(key);
      if (path) {
        await rm(/*turbopackIgnore: true*/ path, { force: true });
      }
    },

    async put({ bytes, contentType, folder }) {
      const key = `${folder.toLowerCase()}/${createId()}.${IMAGE_EXTENSIONS[contentType]}`;
      const path = pathFor(key);
      if (!path) {
        throw new Error("Image folder is not a valid key segment.");
      }
      await mkdir(/*turbopackIgnore: true*/ join(root, folder.toLowerCase()), {
        recursive: true,
      });
      await writeFile(/*turbopackIgnore: true*/ path, bytes, { flag: "wx" });
      return { key, url: `/api/v1/images/${key}` };
    },

    /** The stored bytes and type, or null for unknown or unsafe keys. */
    async read(key: string): Promise<null | {
      bytes: Uint8Array<ArrayBuffer>;
      contentType: ImageContentType;
    }> {
      const path = pathFor(key);
      const extension = key.split(".").pop() ?? "";
      const contentType = CONTENT_TYPES[extension];
      if (!path || !contentType) {
        return null;
      }
      try {
        return {
          bytes: new Uint8Array(await readFile(/*turbopackIgnore: true*/ path)),
          contentType,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
  } satisfies ImageStorage & { read: unknown };
}
