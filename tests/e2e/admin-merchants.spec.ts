import type { Browser, Page } from "@playwright/test";

import {
  apiJson,
  expect,
  fillFields,
  forgedAdminRscHeaders,
  grantAdminRole,
  newClientContext,
  onboardMerchant,
  signUpFresh,
  test,
  uniqueEmail,
} from "./helpers";

async function openAdmin(browser: Browser) {
  const context = await newClientContext(browser);
  const page = await context.newPage();
  grantAdminRole(await signUpFresh(page, "admin"));
  return { context, page };
}

async function submittedShop(page: Page, storeName: string) {
  await signUpFresh(page, "seller");
  const contactEmail = uniqueEmail("contact");
  const created = await onboardMerchant(page, { contactEmail, storeName });
  await page.request.post("/api/v1/merchant/profile/submit");
  return { contactEmail, id: (created.data as { id: string }).id };
}

test("Scenario A: a shop is submitted, approved by an admin, and opens its dashboard", async ({
  browser,
  page,
}) => {
  const storeName = `Bidri Works ${Date.now()}`;
  await submittedShop(page, storeName);

  const admin = await openAdmin(browser);
  await admin.page.goto("/admin/merchants?status=SUBMITTED");
  await admin.page.getByRole("link", { name: storeName }).click();
  await expect(admin.page.getByText("Unverified")).toBeVisible();
  await admin.page.getByRole("button", { name: "Approve" }).click();
  await expect(admin.page.getByText("APPROVED", { exact: true })).toBeVisible();

  await page.goto("/merchant/dashboard");
  await expect(page).toHaveURL(/\/merchant\/dashboard$/);
  await expect(page.getByRole("heading", { name: storeName })).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await admin.context.close();
});

test("a rejected shop sees the admin's reason", async ({ browser, page }) => {
  const storeName = `Pashmina House ${Date.now()}`;
  const shop = await submittedShop(page, storeName);

  const admin = await openAdmin(browser);
  await admin.page.goto(`/admin/merchants/${shop.id}`);
  await fillFields([
    [
      admin.page.locator("#reject-reason"),
      "Please add a return address in Bengaluru",
    ],
  ]);
  await admin.page.getByRole("button", { name: "Reject" }).click();
  await expect(admin.page.getByText("REJECTED", { exact: true })).toBeVisible();

  await page.goto("/merchant/onboarding");
  await expect(page.getByText("Your shop needs changes")).toBeVisible();
  await expect(
    page.getByText("Please add a return address in Bengaluru"),
  ).toBeVisible();
  await admin.context.close();
});

test("non-admins get 404 and never see merchant data", async ({
  browser,
  page,
}) => {
  const shop = await submittedShop(page, `Hidden Shop ${Date.now()}`);

  const other = await newClientContext(browser);
  const snoop = await other.newPage();
  await signUpFresh(snoop, "snoop");

  for (const path of ["/admin/merchants", `/admin/merchants/${shop.id}`]) {
    const response = await snoop.goto(path);
    expect(response?.status()).toBe(404);

    const html = await snoop.request.get(path);
    expect(await html.text()).not.toContain(shop.contactEmail);

    // A navigation that claims the /admin layout is already rendered.
    const rsc = await snoop.request.get(path, {
      headers: forgedAdminRscHeaders(),
    });
    expect(rsc.headers()["content-type"]).toContain("text/x-component");
    expect(await rsc.text()).not.toContain(shop.contactEmail);
  }

  const api = await apiJson(
    await snoop.request.get(`/api/v1/admin/merchants/${shop.id}`),
  );
  expect(api.status).toBe(403);
  await other.close();
});
