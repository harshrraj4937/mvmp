/**
 * Removes the relations the better-auth CLI generates: they are maintained by
 * hand in src/db/schema/users/relations.ts (which also covers non-auth tables).
 * Throws rather than guess when the output has a shape it does not know,
 * because a dropped table here becomes a DROP TABLE in the next migration.
 */
export function stripGeneratedRelations(source: string): string {
  const result = source
    .replace(/^import \{ relations \} from "drizzle-orm";\n/m, "")
    .replace(
      /\nexport const \w+Relations = relations\([\s\S]*?\n\}\)\);\n/g,
      "\n",
    );

  const tables = (text: string) => text.match(/= pgTable\(/g)?.length ?? 0;
  if (/\brelations\b/.test(result) || tables(result) !== tables(source)) {
    throw new Error(
      "auth-db: unexpected relations output from the better-auth CLI; update stripGeneratedRelations",
    );
  }
  return result;
}
