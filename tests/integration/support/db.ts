import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inject } from "vitest";

import type { Database } from "~/db";

import * as schema from "~/db/schema";

/** Drizzle instance bound to the Testcontainers database. */
export function connectTestDb(): {
  close: () => Promise<void>;
  db: Database;
} {
  const client = postgres(inject("databaseUrl"), { max: 2 });
  return {
    close: () => client.end(),
    db: drizzle(client, { schema }),
  };
}
