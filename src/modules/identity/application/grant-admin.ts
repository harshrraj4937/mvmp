import { eq } from "drizzle-orm";

import type { Database } from "~/db";

import { userTable } from "~/db/schema";

import { ADMIN_ROLE, isAdmin } from "../domain/roles";

/**
 * Adds the admin role to an existing user. Admin access is never
 * self-service: this runs only from the admin:grant CLI.
 */
export async function grantAdmin(
  db: Database,
  email: string,
): Promise<"already-admin" | "granted"> {
  const [user] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.email, email));
  if (!user) {
    throw new Error("No user with that email");
  }
  if (isAdmin(user)) {
    return "already-admin";
  }
  const role = user.role ? `${user.role},${ADMIN_ROLE}` : ADMIN_ROLE;
  await db.update(userTable).set({ role }).where(eq(userTable.id, user.id));
  return "granted";
}
