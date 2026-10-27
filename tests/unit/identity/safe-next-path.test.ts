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
