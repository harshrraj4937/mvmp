import { localImageDir } from "~/modules/catalog/application/image-storage";
import { createLocalImageStorage } from "~/modules/catalog/infrastructure/local-image-storage";
import { NotFoundError } from "~/platform/errors";
import { apiRoute } from "~/platform/http";

/**
 * Serves product images stored by the local driver. Keys are random and
 * never reused, so responses are cached for a year. 404 for any other
 * driver, unknown keys, and keys that try to leave the image directory.
 */
export const GET = apiRoute(
  async (_request, context: RouteContext<"/api/v1/images/[...key]">) => {
    const directory = localImageDir();
    const { key } = await context.params;
    const image = directory
      ? await createLocalImageStorage(directory).read(key.join("/"))
      : null;
    if (!image) {
      throw new NotFoundError("Image not found.");
    }
    return new Response(image.bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.bytes.byteLength),
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
