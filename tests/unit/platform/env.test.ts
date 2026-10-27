import { describe, expect, test } from "vitest";

import { parseServerEnv } from "~/platform/env";

const valid = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://u:p@localhost:5432/gillu",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_SERVER_APP_URL: "http://localhost:3000",
};

describe("parseServerEnv", () => {
  test("accepts a minimal valid environment and defaults LOG_LEVEL to info", () => {
    expect(parseServerEnv(valid)).toMatchObject({
      ...valid,
      LOG_LEVEL: "info",
    });
  });

  test("treats empty optional provider credentials as absent", () => {
    expect(
      parseServerEnv({ ...valid, AUTH_GOOGLE_ID: "" }).AUTH_GOOGLE_ID,
    ).toBeUndefined();
  });

  test("names a missing DATABASE_URL", () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    expect(() => parseServerEnv(rest)).toThrow(/DATABASE_URL/);
  });

  test("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      parseServerEnv({ ...valid, DATABASE_URL: "mysql://u:p@h/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  test("rejects a short AUTH_SECRET without echoing it", () => {
    const secret = "short-secret-value";
    let message = "";
    try {
      parseServerEnv({ ...valid, AUTH_SECRET: secret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/AUTH_SECRET/);
    expect(message).not.toContain(secret);
  });
});
