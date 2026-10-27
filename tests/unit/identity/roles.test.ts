import { expect, test } from "vitest";

import { isAdmin } from "~/modules/identity/domain/roles";

test.each([
  [{ role: "admin" }, true],
  [{ role: "user,admin" }, true],
  [{ role: "user" }, false],
  [{ role: null }, false],
  [{}, false],
  [{ role: "administrator" }, false],
])("isAdmin(%j) is %s", (user, expected) => {
  expect(isAdmin(user)).toBe(expected);
});
