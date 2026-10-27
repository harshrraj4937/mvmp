import { Writable } from "node:stream";
import { beforeAll, expect, test, vi } from "vitest";

beforeAll(() => {
  vi.stubEnv("AUTH_SECRET", "a".repeat(32));
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/gillu");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_SERVER_APP_URL", "http://localhost:3000");
});

test("redacts secret keys both at the top level and one level down", async () => {
  const { createLogger } = await import("~/platform/logger");
  const lines: string[] = [];
  const log = createLogger(
    new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    }),
  );

  log.info(
    {
      authorization: "Bearer top-auth",
      nested: { cookie: "nested-cookie", token: "nested-token" },
      password: "top-password",
      secret: "top-secret",
      token: "top-token",
    },
    "provider call",
  );

  const output = lines.join("");
  for (const value of [
    "top-auth",
    "nested-cookie",
    "nested-token",
    "top-password",
    "top-secret",
    "top-token",
  ]) {
    expect(output).not.toContain(value);
  }
  expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
    msg: "provider call",
    nested: { token: "[redacted]" },
    password: "[redacted]",
  });
});
