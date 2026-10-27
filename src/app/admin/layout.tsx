import type React from "react";

import { requireAdmin } from "~/modules/identity";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-6 text-3xl font-bold">Admin Dashboard</h1>
      {children}
    </div>
  );
}
