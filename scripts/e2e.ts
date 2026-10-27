// Runs the Playwright suite against a production build backed by a
// throwaway Postgres from docker-compose.test.yml.
import { randomBytes } from "node:crypto";

const compose = ["docker", "compose", "-f", "docker-compose.test.yml"];
const inherit = { stderr: "inherit", stdout: "inherit" } as const;

const env = {
  ...process.env,
  AUTH_SECRET: randomBytes(24).toString("hex"),
  DATABASE_URL: "postgresql://gillu_test:gillu_test@localhost:54329/gillu_test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  NEXT_SERVER_APP_URL: "http://localhost:3100",
};

function run(cmd: string[]): void {
  console.log(`$ ${cmd.join(" ")}`);
  const result = Bun.spawnSync(cmd, { env, ...inherit });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (${result.exitCode}): ${cmd.join(" ")}`);
  }
}

let exitCode = 0;
try {
  run([...compose, "up", "-d", "--wait"]);
  run(["bunx", "drizzle-kit", "push", "--force"]);
  run(["bun", "run", "build"]);
  run(["bunx", "playwright", "test", ...process.argv.slice(2)]);
} catch (error) {
  console.error((error as Error).message);
  exitCode = 1;
} finally {
  Bun.spawnSync([...compose, "down", "-v"], inherit);
}
process.exit(exitCode);
