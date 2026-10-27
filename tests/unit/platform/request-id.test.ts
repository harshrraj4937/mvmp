import { expect, test } from "vitest";

import { resolveRequestId } from "~/platform/request-id";

test("keeps a well-formed incoming id", () => {
  expect(resolveRequestId("abc-123_XYZ-789")).toBe("abc-123_XYZ-789");
});

test.each([
  null,
  "",
  "short",
  "has space in it",
  "line\nbreak-injected",
  "x".repeat(129),
])("rejects unsafe incoming ids (%j)", (bad) => {
  const id = resolveRequestId(bad);
  expect(id).not.toBe(bad);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
});
