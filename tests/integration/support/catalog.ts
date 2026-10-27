import { createId } from "@paralleldrive/cuid2";

import type { Database } from "~/db";

import { categoriesTable } from "~/db/schema";

/** An active category with a unique name; returns its id. */
export async function seedCategory(
  db: Database,
  name = `Category ${createId()}`,
): Promise<string> {
  const id = createId();
  await db
    .insert(categoriesTable)
    .values({ id, name, slug: id, sortOrder: 1000 });
  return id;
}
