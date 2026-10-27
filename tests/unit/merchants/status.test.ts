import { describe, expect, test } from "vitest";

import {
  assertTransition,
  canSell,
  canTransition,
  MERCHANT_STATUSES,
  type MerchantStatus,
} from "~/modules/merchants/domain/status";

describe("merchant status transitions", () => {
  test.each<[MerchantStatus, MerchantStatus]>([
    ["DRAFT", "SUBMITTED"],
    ["SUBMITTED", "APPROVED"],
    ["SUBMITTED", "REJECTED"],
    ["REJECTED", "SUBMITTED"],
    ["APPROVED", "SUSPENDED"],
    ["SUSPENDED", "APPROVED"],
  ])("%s → %s allowed", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => {
      assertTransition(from, to);
    }).not.toThrow();
  });

  test.each<[MerchantStatus, MerchantStatus]>([
    ["DRAFT", "APPROVED"],
    ["APPROVED", "REJECTED"],
    ["REJECTED", "APPROVED"],
    ["SUBMITTED", "SUBMITTED"],
    ["SUSPENDED", "SUBMITTED"],
  ])("%s → %s refused", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => {
      assertTransition(from, to);
    }).toThrow(
      expect.objectContaining({ code: "invalid_transition", status: 409 }),
    );
  });

  test("only APPROVED merchants can sell", () => {
    expect(MERCHANT_STATUSES.filter(canSell)).toEqual(["APPROVED"]);
  });
});
