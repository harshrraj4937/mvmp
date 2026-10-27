import { describe, expect, test } from "vitest";

import { formatPaise, parseRupees } from "~/modules/catalog/domain/money";

describe("parseRupees", () => {
  test.each([
    ["399", 39900],
    ["1299.5", 129950],
    ["1299.50", 129950],
    ["₹1,299", 129900],
    ["₹ 1,299.99", 129999],
    [" 1299 ", 129900],
    ["0.01", 1],
    ["0.10", 10],
    ["1,00,000", 10000000],
    ["10000000", 1000000000],
  ])("parses %j", (input, paise) => {
    expect(parseRupees(input)).toBe(paise);
  });

  test.each([
    "",
    " ",
    "0",
    "0.00",
    "-5",
    "1299.505",
    "abc",
    "1e3",
    "12.3.4",
    ".5",
    "5.",
    "10000000.01",
    "99999999999999999999",
    "₹",
  ])("rejects %j", (input) => {
    expect(parseRupees(input)).toBeNull();
  });
});

describe("formatPaise", () => {
  test("shows decimals only when there are paise", () => {
    expect(formatPaise(129950)).toBe("₹1,299.50");
    expect(formatPaise(39900)).toBe("₹399");
    expect(formatPaise(1)).toBe("₹0.01");
  });

  test("uses Indian digit grouping", () => {
    expect(formatPaise(10000000)).toBe("₹1,00,000");
    expect(formatPaise(1000000000)).toBe("₹1,00,00,000");
  });
});
