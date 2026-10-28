import "server-only";

export {
  type AddressView,
  createAddress,
  deleteAddress,
  listAddresses,
  MAX_ADDRESSES,
  updateAddress,
} from "./application/addresses";
export {
  advanceMerchantOrder,
  cancelMerchantOrder,
  countMerchantOrders,
  getMerchantOrder,
  listMerchantOrders,
  MERCHANT_ORDERS_PAGE_SIZE,
  type MerchantOrderSummary,
  type MerchantOrderView,
} from "./application/merchant-orders";
export { placeOrder } from "./application/place-order";
export {
  cancelShopperOrder,
  getShopperOrder,
  listShopperOrders,
  type OrderSummary,
} from "./application/shopper-orders";
export type {
  AddressSnapshot,
  OrderItemView,
  OrderView,
  PartView,
} from "./application/views";
export {
  addressPatchSchema,
  addressSchema,
  merchantCancelSchema,
  merchantOrderListQuerySchema,
  merchantStatusSchema,
  placeOrderSchema,
  shopperCancelSchema,
} from "./presentation/schemas";
