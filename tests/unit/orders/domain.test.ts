import { describe, expect, test } from "vitest";

import { deriveOrderStatus } from "~/modules/orders/domain/derive";
import {
  MAKER_STATUS_TEXT,
  SHOPPER_STATUS_TEXT,
} from "~/modules/orders/domain/labels";
import {
  orderNumber,
  partLetter,
  partNumber,
} from "~/modules/orders/domain/numbers";
import { FULFILMENT_STATUSES } from "~/modules/orders/domain/statuses";
import {
  canTransition,
  releaseMode,
} from "~/modules/orders/domain/transitions";

describe("fulfilment transitions", () => {
  test("merchant steps, system steps and cancel", () => {
    expect(canTransition("NEW", "ACKNOWLEDGED", "MERCHANT")).toBe(true);
    expect(canTransition("ACKNOWLEDGED", "PACKING", "MERCHANT")).toBe(true);
    expect(canTransition("PACKING", "READY_FOR_PICKUP", "MERCHANT")).toBe(true);
    expect(canTransition("NEW", "PACKING", "MERCHANT")).toBe(false);
    expect(canTransition("NEW", "ACKNOWLEDGED", "SHOPPER")).toBe(false);
    expect(
      canTransition("READY_FOR_PICKUP", "HANDED_TO_COURIER", "MERCHANT"),
    ).toBe(false);
    expect(
      canTransition("READY_FOR_PICKUP", "HANDED_TO_COURIER", "SYSTEM"),
    ).toBe(true);
    expect(canTransition("HANDED_TO_COURIER", "FULFILLED", "SYSTEM")).toBe(
      true,
    );
    expect(canTransition("HANDED_TO_COURIER", "CANCELED", "SHOPPER")).toBe(
      true,
    );
    expect(canTransition("NEW", "CANCELED", "MERCHANT")).toBe(true);
    expect(canTransition("FULFILLED", "CANCELED", "SHOPPER")).toBe(false);
    expect(canTransition("CANCELED", "CANCELED", "MERCHANT")).toBe(false);
    expect(canTransition("CANCELED", "NEW", "SYSTEM")).toBe(false);
  });

  test("release mode", () => {
    expect(releaseMode("SHOPPER", null)).toBe("release");
    expect(releaseMode("MERCHANT", "CANNOT_FULFIL")).toBe("release");
    expect(releaseMode("MERCHANT", "OTHER")).toBe("release");
    expect(releaseMode("MERCHANT", "OUT_OF_STOCK")).toBe("write_off");
    expect(releaseMode("MERCHANT", "DAMAGED")).toBe("write_off");
  });
});

describe("order status", () => {
  test("order status derives from parts", () => {
    expect(deriveOrderStatus(["NEW", "NEW"])).toBe("CONFIRMED");
    expect(deriveOrderStatus(["NEW", "PACKING"])).toBe("PROCESSING");
    expect(deriveOrderStatus(["FULFILLED", "PACKING"])).toBe(
      "PARTIALLY_FULFILLED",
    );
    expect(deriveOrderStatus(["FULFILLED", "CANCELED"])).toBe("COMPLETED");
    expect(deriveOrderStatus(["CANCELED", "CANCELED"])).toBe("CANCELED");
    expect(deriveOrderStatus(["CANCELED", "NEW"])).toBe("CONFIRMED");
  });
});

describe("numbers and words", () => {
  test("numbers", () => {
    expect(orderNumber(1001)).toBe("GIL-1001");
    expect([0, 1, 25, 26, 27].map(partLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
    ]);
    expect(partNumber("GIL-1001", 1)).toBe("GIL-1001-B");
  });

  test("every status has words for maker and shopper", () => {
    for (const status of FULFILMENT_STATUSES) {
      expect(MAKER_STATUS_TEXT[status]).toBeTruthy();
      expect(SHOPPER_STATUS_TEXT[status]).toBeTruthy();
    }
    expect(MAKER_STATUS_TEXT.READY_FOR_PICKUP).toBe(
      "Packed — waiting for pickup",
    );
    expect(SHOPPER_STATUS_TEXT.NEW).toBe("Order placed");
    expect(SHOPPER_STATUS_TEXT.HANDED_TO_COURIER).toBe("On its way");
  });
});
