import { expect, test } from "vitest";

import { safeNextPath } from "~/lib/safe-next-path";

test.each(["/merchant/onboarding", "/merchant/profile?tab=1", "/"])(
  "keeps local path %s",
  (path) => {
    expect(safeNextPath(path)).toBe(path);
  },
);

test.each([
  null,
  undefined,
  "",
  "//evil.com",
  "/\\evil.com",
  "https://evil.com",
  "javascript:alert(1)",
  "%2F%2Fevil.com",
  "/%2F/evil.com",
  "/%5Cevil.com",
  "evil.com",
  " /merchant",
  "/merchant ",
  "%E0%A4%A",
])("rejects %s", (path) => {
  expect(safeNextPath(path)).toBeNull();
});

// Next.js decodes searchParams before the page sees them, and URL parsing
// drops tabs and newlines: "/\t/evil.com" resolves to https://evil.com/.
test.each([
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  "/%09/evil.com",
  "/\u0000x",
])("rejects control characters in %j", (path) => {
  expect(safeNextPath(path)).toBeNull();
});
