import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import type { Database } from "~/db";
import type { AdminActor } from "~/modules/identity";

import { categoriesTable } from "~/db/schema";
import { suggestSlug } from "~/lib/slug";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError, NotFoundError } from "~/platform/errors";

import type { CompositionLabel } from "../domain/constants";
import type { CategoryCreate, CategoryPatch } from "../presentation/schemas";

export interface Category {
  compositionLabel: CompositionLabel;
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
  sortOrder: number;
}

const columns = {
  compositionLabel: categoriesTable.compositionLabel,
  id: categoriesTable.id,
  isActive: categoriesTable.isActive,
  name: categoriesTable.name,
  slug: categoriesTable.slug,
  sortOrder: categoriesTable.sortOrder,
};

const order = [asc(categoriesTable.sortOrder), asc(categoriesTable.name)];

const categoryExists = () =>
  new ConflictError("category_exists", "A category with that name exists.");

/**
 * Adds a category. Names are unique ignoring case; the slug comes from the
 * name once and stays when the category is renamed (it will appear in URLs).
 */
export async function createCategory(
  db: Database,
  _admin: AdminActor,
  input: CategoryCreate,
): Promise<Category> {
  await assertNameFree(db, input.name);
  const slug = suggestSlug(input.name) || createId();
  try {
    const [row] = await db
      .insert(categoriesTable)
      .values({
        compositionLabel: input.compositionLabel,
        id: createId(),
        name: input.name,
        slug,
        sortOrder: input.sortOrder ?? (await nextSortOrder(db)),
      })
      .returning(columns);
    if (!row) {
      throw new Error("Category insert returned no row.");
    }
    return row;
  } catch (error) {
    throw uniqueViolation(error) ? categoryExists() : error;
  }
}

/** Categories merchants may pick and shoppers may browse. */
export async function listActiveCategories(db: Database): Promise<Category[]> {
  return db
    .select(columns)
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(...order);
}

/** Every category, active or not, for the admin page. */
export async function listCategories(
  db: Database,
  // Proof the caller is an admin; not otherwise needed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _admin: AdminActor,
): Promise<Category[]> {
  return db
    .select(columns)
    .from(categoriesTable)
    .orderBy(...order);
}

export async function updateCategory(
  db: Database,
  _admin: AdminActor,
  id: string,
  patch: CategoryPatch,
): Promise<Category> {
  if (patch.name !== undefined) {
    await assertNameFree(db, patch.name, id);
  }
  try {
    const [row] = await db
      .update(categoriesTable)
      .set(patch)
      .where(eq(categoriesTable.id, id))
      .returning(columns);
    if (!row) {
      throw new NotFoundError("Category not found.");
    }
    return row;
  } catch (error) {
    throw uniqueViolation(error) ? categoryExists() : error;
  }
}

async function assertNameFree(
  db: Database,
  name: string,
  exceptId?: string,
): Promise<void> {
  const sameName = sql`lower(${categoriesTable.name}) = lower(${name.trim()})`;
  const [clash] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(
      exceptId ? and(sameName, ne(categoriesTable.id, exceptId)) : sameName,
    )
    .limit(1);
  if (clash) {
    throw categoryExists();
  }
}

async function nextSortOrder(db: Database): Promise<number> {
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${categoriesTable.sortOrder}), 0)::int`,
    })
    .from(categoriesTable);
  return (row?.max ?? 0) + 10;
}
