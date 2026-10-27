import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "~/lib/auth";
import { ForbiddenError, UnauthorizedError } from "~/platform/http";

import { isAdmin } from "./domain/roles";

export { isAdmin } from "./domain/roles";

/** A signed-in user whose admin role was checked on this request. */
export type AdminActor = SessionUser & { readonly admin: true };

export interface SessionUser {
  email: string;
  id: string;
  name: string;
  role: null | string;
}

/** API/data guard: the signed-in admin, or 401/403. */
export async function authorizeAdmin(): Promise<AdminActor> {
  const user = await authorizeSession();
  if (!isAdmin(user)) {
    throw new ForbiddenError();
  }
  return { ...user, admin: true };
}

/** API/data guard: the signed-in user, or 401. */
export async function authorizeSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/** The signed-in user, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<null | SessionUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const { email, id, name, role } = session.user;
  return { email, id, name, role: role ?? null };
});

/**
 * Page guard: the signed-in admin; anyone else gets a 404 so the area stays
 * hidden. Call it in every admin page and admin data function, not only the
 * layout: a layout does not stop its pages from rendering.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const user = await requireSession();
  if (!isAdmin(user)) {
    notFound();
  }
  return { ...user, admin: true };
}

/**
 * Page guard: the signed-in user, or a redirect to sign-in that comes back
 * to `nextPath` afterwards.
 */
export async function requireSession(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(
      nextPath
        ? `/auth/sign-in?next=${encodeURIComponent(nextPath)}`
        : "/auth/sign-in",
    );
  }
  return user;
}
