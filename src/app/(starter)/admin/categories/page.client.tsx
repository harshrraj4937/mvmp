"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Category } from "~/modules/catalog/application/categories";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (request: () => ReturnType<typeof sendJson>) => {
    setBusy(true);
    setError("");
    const result = await request();
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

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      await run(() => sendJson("/api/v1/admin/categories", "POST", { name }))
    ) {
      setName("");
    }
  };

  return (
    <div className="grid gap-6">
      <form
        className="flex flex-wrap items-end gap-3"
        noValidate
        onSubmit={add}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="category-name">New category</Label>
          <Input
            id="category-name"
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
        </div>
        <Button disabled={busy} type="submit">
          Add category
        </Button>
      </form>
      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <CategoryRow
              busy={busy}
              category={category}
              key={`${category.id}:${category.name}:${category.sortOrder}`}
              onSave={(patch) =>
                run(() =>
                  sendJson(
                    `/api/v1/admin/categories/${category.id}`,
                    "PATCH",
                    patch,
                  ),
                )
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CategoryRow({
  busy,
  category,
  onSave,
}: {
  busy: boolean;
  category: Category;
  onSave: (patch: Partial<Category>) => Promise<boolean>;
}) {
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const changed =
    name.trim() !== category.name || sortOrder !== String(category.sortOrder);

  return (
    <TableRow>
      <TableCell>
        <Input
          aria-label={`Name of ${category.name}`}
          onChange={(event) => {
            setName(event.target.value);
          }}
          value={name}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">{category.slug}</TableCell>
      <TableCell>
        <Input
          aria-label={`Order of ${category.name}`}
          className="w-24"
          inputMode="numeric"
          onChange={(event) => {
            setSortOrder(event.target.value);
          }}
          value={sortOrder}
        />
      </TableCell>
      <TableCell>
        <Badge variant={category.isActive ? "default" : "outline"}>
          {category.isActive ? "Active" : "Hidden"}
        </Badge>
      </TableCell>
      <TableCell className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !changed}
          onClick={() =>
            void onSave({ name, sortOrder: Number.parseInt(sortOrder, 10) })
          }
          size="sm"
          variant="outline"
        >
          Save
        </Button>
        <Button
          disabled={busy}
          onClick={() => void onSave({ isActive: !category.isActive })}
          size="sm"
          variant="outline"
        >
          {category.isActive
            ? `Hide ${category.name}`
            : `Show ${category.name}`}
        </Button>
      </TableCell>
    </TableRow>
  );
}
