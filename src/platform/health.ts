import type postgres from "postgres";

export type DependencyHealth = "ok" | "unreachable";

/** Probes the database with `select 1`; never throws and never waits past the timeout. */
export async function checkDatabaseHealth(
  sql: postgres.Sql,
  timeoutMs = 2000,
): Promise<DependencyHealth> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DependencyHealth>((resolve) => {
    timer = setTimeout(() => resolve("unreachable"), timeoutMs);
  });
  const probe = sql`select 1`.then(
    (): DependencyHealth => "ok",
    (): DependencyHealth => "unreachable",
  );
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
