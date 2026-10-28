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
  addressPatchSchema,
  addressSchema,
} from "./presentation/schemas";
