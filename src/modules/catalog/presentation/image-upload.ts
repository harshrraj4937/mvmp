import { ValidationError } from "~/platform/errors";

import { MAX_IMAGE_BYTES } from "../domain/constants";

/** Room for multipart boundaries and the alt field around the file. */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Reads a multipart upload: field `file` (the image) and optional `alt`.
 * Anything else, or a body far over the image limit, is a 400 before the
 * bytes are read. The image itself is checked by addProductImage.
 */
export async function readImageUpload(
  request: Request,
): Promise<{ alt?: string; bytes: Uint8Array; name: string }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD) {
    throw new ValidationError("Images must be 4 MB or smaller.", {
      file: ["Images must be 4 MB or smaller."],
    });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Send the image as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError(undefined, {
      file: ["Choose an image to upload."],
    });
  }
  const alt = form.get("alt");
  return {
    alt: typeof alt === "string" ? alt.slice(0, 200) : undefined,
    bytes: new Uint8Array(await file.arrayBuffer()),
    name: file.name,
  };
}
