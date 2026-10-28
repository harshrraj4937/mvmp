import { db } from "~/db";
import { getImageStorage, readImageUpload } from "~/modules/catalog";
import { addStoryImage, authorizeMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

/** Multipart upload: `file` (JPEG, PNG or WebP, ≤ 4 MB) and optional `alt`. */
export const POST = apiRoute(async (request) => {
  const merchant = await authorizeMerchant();
  const storage = getImageStorage();
  const upload = await readImageUpload(request);
  return ok(await addStoryImage(db, storage, merchant, upload), 201);
});
