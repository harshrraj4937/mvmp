import type React from "react";

import Link from "next/link";

import { requireAdmin } from "~/modules/identity";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-4 text-3xl font-bold">Admin Dashboard</h1>
      <nav
        aria-label="Admin"
        className="mb-6 flex gap-4 text-sm text-muted-foreground"
      >
        <Link href="/admin/merchants">Merchants</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/summary">Users &amp; uploads</Link>
      </nav>
      {children}
    </div>
  );
}
