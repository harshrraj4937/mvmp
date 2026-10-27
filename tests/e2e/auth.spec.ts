import {
  expect,
  sessionEmail,
  signIn,
  signOut,
  signUp,
  test,
  uniqueEmail,
} from "./helpers";

const password = "Correct-Horse-9-Battery";

test("sign up, sign out and sign back in with email and password", async ({
  page,
}) => {
  const user = { email: uniqueEmail("smoke"), name: "Asha Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);

  await signOut(page);
  expect(await sessionEmail(page)).toBeNull();

  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);
});

test("wrong password shows an error and does not create a session", async ({
  page,
}) => {
  const user = { email: uniqueEmail("wrongpw"), name: "Ravi Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await signIn(page, user.email, "not-the-password");
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  expect(await sessionEmail(page)).toBeNull();
});

test("signing up twice with the same email shows an error", async ({
  page,
}) => {
  const user = { email: uniqueEmail("dup"), name: "Meera Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await signUp(page, user);
  await expect(
    page.getByText("Registration failed. Please try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-up/);
  expect(await sessionEmail(page)).toBeNull();
});

test("social buttons appear only for configured providers", async ({
  page,
}) => {
  // The E2E environment has no Google or GitHub credentials.
  for (const path of ["/auth/sign-in", "/auth/sign-up"]) {
    await page.goto(path);
    await expect(page.locator("#email")).toBeVisible();
    // The card holding the form; the site footer has its own GitHub link.
    const card = page.locator("form").locator("xpath=..");
    await expect(card.getByText("Or continue with")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Google" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "GitHub" })).toHaveCount(0);
  }
});

test("sign-in returns to a safe next path", async ({ page }) => {
  const user = { email: uniqueEmail("next"), name: "Meera Next", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await page.goto("/auth/sign-in?next=%2Fdashboard%2Fprofile");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
});

test("sign-in ignores an off-site next path", async ({ page }) => {
  const user = { email: uniqueEmail("evilnext"), name: "Ravi Next", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await page.goto("/auth/sign-in?next=%2F%2Fevil.com");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/uploads$/);
});
