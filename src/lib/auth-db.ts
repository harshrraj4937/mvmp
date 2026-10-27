import { execaCommand } from "execa";
import fs from "fs-extra";
import MagicString from "magic-string";
import path from "pathe";

const configPath = "./src/lib/auth.ts";
const schemaPath = "./src/db/schema/users/tables.ts";

async function main() {
  await execaCommand(
    `npx auth@latest generate --config ${configPath} --output ${schemaPath} --yes`,
    { stdio: "inherit" },
  );

  const filePath = path.resolve(schemaPath);
  // Relations are maintained by hand in ./relations.ts (they also cover
  // non-auth tables such as uploads), so drop the generated ones.
  const originalContent = (await fs.readFile(filePath, "utf8"))
    .replace(/^import \{ relations \} from "drizzle-orm";\n/m, "")
    .replace(/\nexport const \w+Relations = relations\([\s\S]*$/, "\n");

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
