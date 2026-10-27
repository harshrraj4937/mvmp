import Link from "next/link";
import { z } from "zod";

import { db } from "~/db";
import { requireAdmin } from "~/modules/identity";
import { listMerchants, MERCHANT_STATUSES } from "~/modules/merchants";
import { Badge } from "~/ui/primitives/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

const tabs = [undefined, ...MERCHANT_STATUSES.filter((s) => s !== "DRAFT")];

export default async function AdminMerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // Authorize in the page itself: the admin layout does not stop this
  // segment from rendering.
  const admin = await requireAdmin();
  const { status: raw } = await searchParams;
  const parsed = z.enum(MERCHANT_STATUSES).safeParse(raw);
  const status = parsed.success ? parsed.data : undefined;
  const merchants = await listMerchants(db, admin, { status });

  return (
    <div className="grid gap-4">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            aria-current={tab === status ? "page" : undefined}
            className={
              tab === status
                ? `
                  rounded-md bg-primary px-3 py-1 text-sm
                  text-primary-foreground
                `
                : "rounded-md border px-3 py-1 text-sm"
            }
            href={tab ? `/admin/merchants?status=${tab}` : "/admin/merchants"}
            key={tab ?? "ALL"}
          >
            {tab ? tab.charAt(0) + tab.slice(1).toLowerCase() : "All"}
          </Link>
        ))}
      </nav>
      {merchants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shops here.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Shop URL</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.map((merchant) => (
              <TableRow key={merchant.id}>
                <TableCell>
                  <Link
                    className="font-medium underline"
                    href={`/admin/merchants/${merchant.id}`}
                  >
                    {merchant.storeName}
                  </Link>
                </TableCell>
                <TableCell>/shops/{merchant.slug}</TableCell>
                <TableCell>{merchant.ownerEmail ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{merchant.status}</Badge>
                </TableCell>
                <TableCell>
                  {merchant.submittedAt?.toLocaleDateString("en-IN") ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
