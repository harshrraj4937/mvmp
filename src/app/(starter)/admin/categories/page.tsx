import { db } from "~/db";
import { listCategories } from "~/modules/catalog";
import { requireAdmin } from "~/modules/identity";

import { CategoryManager } from "./page.client";

export default async function AdminCategoriesPage() {
  // Authorize in the page itself: the admin layout does not stop this
  // segment from rendering.
  const admin = await requireAdmin();
  const categories = await listCategories(db, admin);
  return <CategoryManager categories={categories} />;
}
