import "server-only";

export {
  holdProduct,
  listProductsForAdmin,
  releaseProduct,
} from "./application/admin";
export {
  type Category,
  createCategory,
  listActiveCategories,
  listCategories,
  updateCategory,
} from "./application/categories";
export { getImageStorage } from "./application/image-storage";
export {
  addProductImage,
  deleteProductImage,
  updateProductImage,
} from "./application/images";
export {
  adjustStock,
  listStockMovements,
  type StockMovementView,
} from "./application/inventory";
export {
  catalogCounts,
  createProduct,
  getProduct,
  listProducts,
  type ProductDetail,
  type ProductImageView,
  type ProductSummary,
  updateProduct,
} from "./application/products";
export type { VariantView } from "./application/shared";
export {
  archiveProduct,
  publishProduct,
  unpublishProduct,
} from "./application/status";
export {
  type CartVariantInfo,
  getStorefrontProduct,
  getStorefrontShop,
  getVariantsForCart,
  searchStorefront,
  type StorefrontCard,
  storefrontHighlights,
  type StorefrontProduct,
  type StorefrontShop,
  storyExcerpt,
} from "./application/storefront";
export { addVariant, updateVariant } from "./application/variants";
export { readImageUpload } from "./presentation/image-upload";
export {
  categoryCreateSchema,
  categoryPatchSchema,
  holdSchema,
  imagePatchSchema,
  productCreateSchema,
  productListQuerySchema,
  productPatchSchema,
  stockAdjustmentSchema,
  variantCreateSchema,
  variantPatchSchema,
} from "./presentation/schemas";
export {
  parseStorefrontSearchParams,
  type StorefrontQuery,
  storefrontQuerySchema,
} from "./presentation/storefront-query";
