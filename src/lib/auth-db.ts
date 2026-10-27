import { execaCommand } from "execa";
import fs from "fs-extra";
import MagicString from "magic-string";
import path from "pathe";

import { stripGeneratedRelations } from "./auth-db-transform";

const configPath = "./src/lib/auth.ts";
const schemaPath = "./src/db/schema/users/tables.ts";

// Generate with the CLI matching the installed better-auth, not @latest.
const { version: authCliVersion } = (await fs.readJson(
  "./node_modules/better-auth/package.json",
)) as { version: string };

async function main() {
  await execaCommand(
    `npx auth@${authCliVersion} generate --config ${configPath} --output ${schemaPath} --yes`,
    { stdio: "inherit" },
  );

  const filePath = path.resolve(schemaPath);
  const originalContent = stripGeneratedRelations(
    await fs.readFile(filePath, "utf8"),
  );

  const s = new MagicString(originalContent);

  const notice = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 * 
 * To modify the schema, edit src/lib/auth.ts instead,
 * then run 'bun db:auth' to regenerate this file.
 * 
 * Any direct changes to this file will be overwritten.
 */

`;
  s.prepend(notice);

  s.replace(
    /export const (\w+) = pgTable/g,
    (_match: string, tableName: string) => {
      return `export const ${tableName}Table = pgTable`;
    },
  );

  const tableNames: string[] = [];
  const tableMatches = originalContent.matchAll(
    /export const (\w+) = pgTable/g,
  );

  for (const match of tableMatches) {
    if (match[1]) {
      tableNames.push(match[1]);
    }
  }

  console.log("√ Ensured better-auth tables:", tableNames);

  for (const tableName of tableNames) {
    s.replace(
      new RegExp(`\\(\\)\\s*=>\\s*${tableName}\\s*\\.`, "g"),
      (match: string) => {
        return match.replace(tableName, `${tableName}Table`);
      },
    );
  }

  await fs.writeFile(filePath, s.toString(), "utf8");

  await execaCommand(`bunx eslint --fix ${schemaPath}`, { stdio: "inherit" });

  await execaCommand(`bunx biome check --write ${schemaPath}`, {
    stdio: "inherit",
  });
}

await main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
