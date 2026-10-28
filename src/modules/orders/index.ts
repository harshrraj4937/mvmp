import "server-only";

export {
  type AddressView,
  createAddress,
  deleteAddress,
  listAddresses,
  MAX_ADDRESSES,
  updateAddress,
} from "./application/addresses";
export { placeOrder } from "./application/place-order";
export type {
  AddressSnapshot,
  OrderItemView,
  OrderView,
  PartView,
} from "./application/views";
export {
  addressPatchSchema,
  addressSchema,
  placeOrderSchema,
} from "./presentation/schemas";
