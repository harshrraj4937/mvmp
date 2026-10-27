import { z } from "zod";

const categoryFields = z.object({
  isActive: z.boolean(),
  name: z.string().trim().min(2).max(60),
  sortOrder: z.number().int().min(0).max(100_000),
});

export const categoryCreateSchema = categoryFields
  .pick({ name: true, sortOrder: true })
  .partial({ sortOrder: true });

export const categoryPatchSchema = categoryFields
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export type CategoryCreate = z.output<typeof categoryCreateSchema>;
export type CategoryPatch = z.output<typeof categoryPatchSchema>;
