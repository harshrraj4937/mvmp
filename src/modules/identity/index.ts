import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "~/lib/auth";

import { isAdmin } from "./domain/roles";

export { isAdmin } from "./domain/roles";

export interface SessionUser {
  email: string;
  id: string;
  name: string;
  role: null | string;
}

/**
 * Returns the signed-in admin; anyone else gets a 404 so the area stays hidden.
 * Call it in every admin page and admin data function, not only the layout:
 * a layout does not stop its pages from rendering.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (!isAdmin(user)) {
    notFound();
  }
  return user;
}

/**
 * Returns the signed-in user, or redirects to sign-in. Cached per request so
 * layout, page and data functions can each call it.
 */
export const requireSession = cache(async (): Promise<SessionUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/auth/sign-in");
  }
  const { email, id, name, role } = session.user;
  return { email, id, name, role: role ?? null };
});
