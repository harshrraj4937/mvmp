import { defineConfig, devices } from "@playwright/test";

// Run through `bun run test:e2e`, which provisions the database and build.
export default defineConfig({
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  testDir: "tests/e2e",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run start -- -p 3100",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://localhost:3100",
  },
});
