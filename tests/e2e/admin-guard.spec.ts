import {
  expect,
  forgedAdminRscHeaders,
  grantAdminRole,
  signOut,
  signUp,
  test,
  uniqueEmail,
} from "./helpers";

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

test("non-admin never receives other users' data from admin pages", async ({
  page,
}) => {
  const victim = uniqueEmail("victim");
  await signUp(page, {
    email: victim,
    name: "Asha Victim",
    password: "Correct-Horse-9-Battery",
  });
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await signUp(page, {
    email: uniqueEmail("snoop"),
    name: "Ravi Snoop",
    password: "Correct-Horse-9-Battery",
  });
  await expect(page).toHaveURL(/\/dashboard\/uploads/);

  const html = await page.request.get("/admin/summary");
  expect(await html.text()).not.toContain(victim);

  // A client-side navigation that claims the /admin layout is already
  // rendered: Next.js then renders only the page segment, skipping the layout.
  const rsc = await page.request.get("/admin/summary", {
    headers: forgedAdminRscHeaders(),
  });
  expect(rsc.headers()["content-type"]).toContain("text/x-component");
  expect(await rsc.text()).not.toContain(victim);
});
