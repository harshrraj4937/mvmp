// Usage: bun run admin:grant <email>
// Grants the admin role to an existing user. Requires the server env.
import { conn, db } from "~/db";
import { grantAdmin } from "~/modules/identity/application/grant-admin";

const email = process.argv[2];
if (!email) {
  console.error("Usage: bun run admin:grant <email>");
  process.exit(1);
}

try {
  console.log(await grantAdmin(db, email));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
