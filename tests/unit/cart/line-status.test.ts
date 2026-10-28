import { describe, expect, test } from "vitest";

import { lineStatus } from "~/modules/cart/domain/line-status";

const line = {
  available: 5,
  currentPricePaise: 10_000,
  purchasable: true,
  quantity: 2,
  seenPricePaise: 10_000,
};

describe("lineStatus precedence", () => {
  test("ok when everything matches", () => {
    expect(lineStatus(line)).toBe("ok");
  });

  test("price_changed when the price moved since the shopper saw it", () => {
    expect(lineStatus({ ...line, currentPricePaise: 12_000 })).toBe(
      "price_changed",
    );
  });

  test("short when the quantity exceeds stock", () => {
    expect(lineStatus({ ...line, available: 1 })).toBe("short");
  });

  test("sold_out when no stock is left", () => {
    expect(lineStatus({ ...line, available: 0 })).toBe("sold_out");
  });

  test("unavailable wins over sold_out, short and price_changed", () => {
    expect(
      lineStatus({
        available: 0,
        currentPricePaise: 12_000,
        purchasable: false,
        quantity: 2,
        seenPricePaise: 10_000,
      }),
    ).toBe("unavailable");
  });

  test("sold_out wins over short and price_changed", () => {
    expect(
      lineStatus({ ...line, available: 0, currentPricePaise: 12_000 }),
    ).toBe("sold_out");
  });

  test("short wins over price_changed", () => {
    expect(
      lineStatus({ ...line, available: 1, currentPricePaise: 12_000 }),
    ).toBe("short");
  });
});
