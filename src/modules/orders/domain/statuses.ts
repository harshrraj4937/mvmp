/** Order, payment and fulfilment states (requirements §18). */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "PARTIALLY_FULFILLED",
  "COMPLETED",
  "CANCELED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["PREPAID", "COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The state of one maker's part of an order. */
export const FULFILMENT_STATUSES = [
  "NEW",
  "ACKNOWLEDGED",
  "PACKING",
  "READY_FOR_PICKUP",
  "HANDED_TO_COURIER",
  "FULFILLED",
  "CANCELED",
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

/** The steps a maker takes from the dashboard. */
export const MERCHANT_STEPS = [
  "ACKNOWLEDGED",
  "PACKING",
  "READY_FOR_PICKUP",
] as const;
export type MerchantStep = (typeof MERCHANT_STEPS)[number];

/** HELD until shipped (CONSUMED) or cancelled (RELEASED or WRITTEN_OFF). */
export const RESERVATION_STATUSES = [
  "HELD",
  "RELEASED",
  "WRITTEN_OFF",
  "CONSUMED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const MAKER_CANCEL_REASONS = [
  "OUT_OF_STOCK",
  "DAMAGED",
  "CANNOT_FULFIL",
  "OTHER",
] as const;
export type MakerCancelReason = (typeof MAKER_CANCEL_REASONS)[number];

export const ACTOR_ROLES = ["SHOPPER", "MERCHANT", "SYSTEM"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];
