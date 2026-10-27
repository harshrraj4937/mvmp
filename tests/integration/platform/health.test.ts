import postgres from "postgres";
import { expect, inject, test } from "vitest";

import { checkDatabaseHealth } from "~/platform/health";

test("reports ok for a reachable database", async () => {
  const sql = postgres(inject("databaseUrl"), { max: 1 });
  try {
    await expect(checkDatabaseHealth(sql)).resolves.toBe("ok");
  } finally {
    await sql.end();
  }
});

test("reports unreachable for a dead database within the timeout", async () => {
  const sql = postgres("postgresql://x:x@127.0.0.1:1/x", {
    connect_timeout: 1,
    max: 1,
  });
  const started = Date.now();
  try {
    await expect(checkDatabaseHealth(sql, 2000)).resolves.toBe("unreachable");
    expect(Date.now() - started).toBeLessThan(3000);
  } finally {
    await sql.end({ timeout: 0 });
  }
});
