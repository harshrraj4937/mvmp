import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { userTable } from "~/db/schema";
import { grantAdmin } from "~/modules/identity/application/grant-admin";

import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
afterAll(close);

async function insertUser(role: null | string): Promise<string> {
  const email = `${createId()}@grant.gillu.test`;
  await db.insert(userTable).values({
    email,
    id: createId(),
    name: "Grant Test",
    role,
  });
  return email;
}

async function roleOf(email: string): Promise<null | string> {
  const [row] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.email, email));
  return row?.role ?? null;
}

test("grants admin to a regular user and keeps existing roles", async () => {
  const email = await insertUser("user");
  await expect(grantAdmin(db, email)).resolves.toBe("granted");
  expect(await roleOf(email)).toBe("user,admin");
});

test("grants admin to a user without a role", async () => {
  const email = await insertUser(null);
  await expect(grantAdmin(db, email)).resolves.toBe("granted");
  expect(await roleOf(email)).toBe("admin");
});

test("is idempotent for an existing admin", async () => {
  const email = await insertUser("admin");
  await expect(grantAdmin(db, email)).resolves.toBe("already-admin");
  expect(await roleOf(email)).toBe("admin");
});

test("rejects an unknown email", async () => {
  await expect(grantAdmin(db, "nobody@grant.gillu.test")).rejects.toThrow(
    /No user with that email/,
  );
});
