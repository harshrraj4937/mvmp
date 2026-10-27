import "server-only";

export {
  type Category,
  createCategory,
  listActiveCategories,
  listCategories,
  updateCategory,
} from "./application/categories";
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
export { addVariant, updateVariant } from "./application/variants";
export {
  categoryCreateSchema,
  categoryPatchSchema,
  productCreateSchema,
  productPatchSchema,
  stockAdjustmentSchema,
  variantCreateSchema,
  variantPatchSchema,
} from "./presentation/schemas";
