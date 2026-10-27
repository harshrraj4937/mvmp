import postgres from "postgres";
import { expect, inject, test } from "vitest";

import { runMigrations } from "~/db/migrate";

async function listPublicTables(databaseUrl: string): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
    `;
    return rows.map((row) => row.table_name);
  } finally {
    await sql.end();
  }
}

test("baseline creates auth and uploads tables and no Polar tables", async () => {
  const tables = await listPublicTables(inject("databaseUrl"));
  expect(tables).toEqual(
    expect.arrayContaining([
      "user",
      "session",
      "account",
      "verification",
      "two_factor",
      "uploads",
    ]),
  );
  expect(tables.filter((table) => table.startsWith("polar"))).toEqual([]);
});

test("running migrations twice is a no-op", async () => {
  await expect(runMigrations(inject("databaseUrl"))).resolves.toBeUndefined();
});
