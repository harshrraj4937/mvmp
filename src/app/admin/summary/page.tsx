import { getUsersWithUploads } from "~/lib/queries/uploads";
import { requireAdmin } from "~/modules/identity";

import AdminPageClient from "./page.client";

export default async function AdminPage() {
  await requireAdmin();
  const data = await getUsersWithUploads();
  return <AdminPageClient initialData={data} />;
}
