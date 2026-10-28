import { describe, expect, test } from "vitest";

import {
  GUEST_CART_COOKIE,
  guestCookieOptions,
  hashGuestToken,
  newGuestToken,
} from "~/modules/cart/presentation/guest-cookie";

describe("guest cart token", () => {
  test("is 32 random bytes, base64url, at least 43 characters", () => {
    const token = newGuestToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(newGuestToken()).not.toBe(token);
  });

  test("hashes deterministically to 64 hex characters", () => {
    const token = newGuestToken();
    expect(hashGuestToken(token)).toBe(hashGuestToken(token));
    expect(hashGuestToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the cookie name is gillu_cart", () => {
    expect(GUEST_CART_COOKIE).toBe("gillu_cart");
  });
});

describe("guestCookieOptions", () => {
  test("HttpOnly, lax, root path, 30 days; Secure only in production", () => {
    expect(guestCookieOptions(true)).toEqual({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(guestCookieOptions(false).secure).toBe(false);
  });
});
