import type { z } from "zod";

import { cookies } from "next/headers";

import { getSessionUser } from "~/modules/identity";
import { ValidationError } from "~/platform/errors";
import { parseJson } from "~/platform/http";

import type { CartCookie, CartOwner } from "../application/cart";

import { GUEST_CART_COOKIE, guestCookieOptions } from "./guest-cookie";

/** Writes or clears the guest cookie as the service asked. */
export async function applyCartCookie(cookie: CartCookie): Promise<void> {
  if (cookie === null) {
    return;
  }
  const store = await cookies();
  if ("clear" in cookie) {
    store.delete(GUEST_CART_COOKIE);
    return;
  }
  store.set(
    GUEST_CART_COOKIE,
    cookie.set,
    guestCookieOptions(process.env.NODE_ENV === "production"),
  );
}

/** A JSON body for the cart; other content types are a 400. */
export async function parseCartBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ValidationError("Send the cart request as JSON.");
  }
  return parseJson(request, schema);
}

/** Who is shopping: the signed-in user, and the guest cookie if any. */
export async function readCartOwner(): Promise<CartOwner> {
  const user = await getSessionUser();
  const store = await cookies();
  return {
    guestToken: store.get(GUEST_CART_COOKIE)?.value ?? null,
    userId: user?.id ?? null,
  };
}
