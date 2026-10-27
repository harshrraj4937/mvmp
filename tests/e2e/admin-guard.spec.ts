import { expect, grantAdminRole, signUp, test, uniqueEmail } from "./helpers";

test("signed-out visitor is sent to sign-in from admin pages", async ({
  page,
}) => {
  await page.goto("/admin/summary");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("non-admin cannot open admin pages", async ({ page }) => {
  await signUp(page, {
    email: uniqueEmail("nonadmin"),
    name: "Kiran Test",
    password: "Correct-Horse-9-Battery",
  });
  await expect(page).toHaveURL(/\/dashboard\/uploads/);

  const response = await page.goto("/admin/summary");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Admin Dashboard")).toHaveCount(0);
});

test("admin granted through the CLI can open admin pages", async ({ page }) => {
  const email = uniqueEmail("admin");
  await signUp(page, {
    email,
    name: "Devi Admin",
    password: "Correct-Horse-9-Battery",
  });
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  grantAdminRole(email);

  const response = await page.goto("/admin/summary");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Admin Dashboard")).toBeVisible();
});
