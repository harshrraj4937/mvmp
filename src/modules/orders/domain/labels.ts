import type { FulfilmentStatus, MakerCancelReason } from "./statuses";

export const MAKER_STATUS_TEXT: Record<FulfilmentStatus, string> = {
  ACKNOWLEDGED: "Preparing",
  CANCELED: "Cancelled",
  FULFILLED: "Delivered",
  HANDED_TO_COURIER: "Picked up",
  NEW: "New",
  PACKING: "Packing",
  READY_FOR_PICKUP: "Packed — waiting for pickup",
};

export const SHOPPER_STATUS_TEXT: Record<FulfilmentStatus, string> = {
  ACKNOWLEDGED: "Being prepared",
  CANCELED: "Cancelled",
  FULFILLED: "Delivered",
  HANDED_TO_COURIER: "On its way",
  NEW: "Order placed",
  PACKING: "Being packed",
  READY_FOR_PICKUP: "Packed",
};

export const MAKER_CANCEL_TEXT: Record<MakerCancelReason, string> = {
  CANNOT_FULFIL: "Can't fulfil this order",
  DAMAGED: "Damaged",
  OTHER: "Other",
  OUT_OF_STOCK: "Out of stock",
};
