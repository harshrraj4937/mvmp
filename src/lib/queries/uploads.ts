import "server-only";
import { desc, eq } from "drizzle-orm";

import type { UserWithUploads } from "~/app/(starter)/admin/summary/page.types";

import { db } from "~/db";
import { uploadsTable, userTable } from "~/db/schema";
import { requireAdmin } from "~/modules/identity";

/** Every user with their uploads. Admin only: authorizes itself, because a
 * layout guard does not stop a page segment from rendering. */
export async function getUsersWithUploads(): Promise<UserWithUploads[]> {
  await requireAdmin();
  try {
    const rows = await db
      .select({
        upload: uploadsTable,
        user: userTable,
      })
      .from(userTable)
      .leftJoin(uploadsTable, eq(userTable.id, uploadsTable.userId))
      .orderBy(desc(userTable.createdAt));

    const usersById = new Map<string, UserWithUploads>();

    for (const { upload, user } of rows) {
      let result = usersById.get(user.id);

      if (!result) {
        result = {
          ...user,
          uploads: [],
        };

        usersById.set(user.id, result);
      }

      if (upload !== null) {
        result.uploads.push(upload);
      }
    }

    return Array.from(usersById.values());
  } catch (error) {
    console.error("Failed to fetch users with uploads:", error);
    return [];
  }
}
