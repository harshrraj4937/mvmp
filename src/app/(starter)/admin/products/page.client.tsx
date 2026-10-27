"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { formatPaise } from "~/modules/catalog/domain/money";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Label } from "~/ui/primitives/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

interface ModeratedProduct {
  adminHoldReason: null | string;
  id: string;
  name: string;
  priceFromPaise: null | number;
  status: string;
  storeName: string;
}

/** Products across shops; pause (hold) published ones, release held ones. */
export function ProductModeration({
  products,
}: {
  products: ModeratedProduct[];
}) {
  const router = useRouter();
  const [pausing, setPausing] = useState<ModeratedProduct | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (path: string, body?: unknown) => {
    setBusy(true);
    setError("");
    const result = await sendJson(path, "POST", body);
    setBusy(false);
    if (result.error) {
      setError(
        Object.values(fieldErrors(result.error))[0] ?? result.error.message,
      );
      return false;
    }
    router.refresh();
    return true;
  };

  const pause = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      pausing &&
      (await run(`/api/v1/admin/products/${pausing.id}/unpublish`, { reason }))
    ) {
      setPausing(null);
      setReason("");
    }
  };

  return (
    <div className="grid gap-4">
      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      {pausing && (
        <form
          className="grid gap-2 rounded-md border p-4"
          noValidate
          onSubmit={pause}
        >
          <Label htmlFor="hold-reason">
            Why is “{pausing.name}” paused? (shown to the merchant)
          </Label>
          <textarea
            className={`
              min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm
            `}
            id="hold-reason"
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            value={reason}
          />
          <div className="flex gap-2">
            <Button disabled={busy} type="submit" variant="destructive">
              Confirm pause
            </Button>
            <Button
              onClick={() => {
                setPausing(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Shop</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Price from</TableHead>
            <TableHead>Hold reason</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.storeName}</TableCell>
              <TableCell>
                <Badge variant="outline">{product.status}</Badge>
              </TableCell>
              <TableCell>
                {product.priceFromPaise === null
                  ? "—"
                  : formatPaise(product.priceFromPaise)}
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">
                {product.adminHoldReason ?? "—"}
              </TableCell>
              <TableCell>
                {product.status === "PUBLISHED" && (
                  <Button
                    aria-label={`Pause ${product.name}`}
                    onClick={() => {
                      setPausing(product);
                      setReason("");
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Pause product
                  </Button>
                )}
                {product.adminHoldReason !== null && (
                  <Button
                    aria-label={`Release ${product.name}`}
                    disabled={busy}
                    onClick={() =>
                      void run(`/api/v1/admin/products/${product.id}/release`)
                    }
                    size="sm"
                  >
                    Release
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
