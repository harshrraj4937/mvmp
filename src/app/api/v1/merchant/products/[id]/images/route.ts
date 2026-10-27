import { db } from "~/db";
import {
  addProductImage,
  getImageStorage,
  readImageUpload,
} from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

/** Multipart upload: `file` (JPEG, PNG or WebP, ≤ 4 MB) and optional `alt`. */
export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/products/[id]/images">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    const storage = getImageStorage();
    const upload = await readImageUpload(request);
    return ok(await addProductImage(db, storage, merchant, id, upload), 201);
  },
);
