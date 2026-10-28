import { createHash, randomBytes } from "node:crypto";

/** The guest cart's cookie: a random token, stored only as its hash. */
export const GUEST_CART_COOKIE = "gillu_cart";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function guestCookieOptions(production: boolean) {
  return {
    httpOnly: true,
    maxAge: THIRTY_DAYS_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: production,
  };
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}
