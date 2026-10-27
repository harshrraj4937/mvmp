import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          hookTimeout: 120_000,
          include: ["tests/integration/**/*.test.ts"],
          name: "integration",
          testTimeout: 60_000,
        },
      },
    ],
  },
});
