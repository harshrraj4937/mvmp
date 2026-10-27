import { expect, test } from "@playwright/test";

import { sessionEmail, signIn, signUp, uniqueEmail } from "./helpers";

test("sign up, sign in and sign out with email and password", async ({
  page,
}) => {
  const user = {
    email: uniqueEmail("smoke"),
    name: "Asha Test",
    password: "Correct-Horse-9-Battery",
  };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/auth\/sign-in\?registered=true/);
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);
  await page.goto("/auth/sign-out");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  expect(await sessionEmail(page)).toBeNull();
});

test("wrong password does not create a session", async ({ page }) => {
  const user = {
    email: uniqueEmail("wrongpw"),
    name: "Ravi Test",
    password: "Correct-Horse-9-Battery",
  };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await signIn(page, user.email, "not-the-password");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  expect(await sessionEmail(page)).toBeNull();
});
