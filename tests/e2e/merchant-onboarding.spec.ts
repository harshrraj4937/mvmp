import type { BrowserContext, Page } from "@playwright/test";

import {
  apiJson,
  expect,
  fillFields,
  grantAdminRole,
  newClientContext,
  onboardMerchant,
  signUpFresh,
  test,
  uniqueEmail,
} from "./helpers";

/** An admin in their own browser context, acting through the API. */
async function adminSession(
  browser: Parameters<typeof newClientContext>[0],
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newClientContext(browser);
  const page = await context.newPage();
  grantAdminRole(await signUpFresh(page, "admin"));
  return { context, page };
}

async function fillOnboardingForm(
  page: Page,
  values: { contactPhone?: string; storeName: string },
): Promise<void> {
  await fillFields([
    [page.locator("#storeName"), values.storeName],
    [page.locator("#contactName"), "Asha Rao"],
    [page.locator("#contactEmail"), "asha@lakshmi-silks.test"],
    [page.locator("#contactPhone"), values.contactPhone ?? "98765 43210"],
    [page.locator("#business-line1"), "12 Chickpet Main Road"],
    [page.locator("#business-city"), "Bengaluru"],
    [page.locator("#business-state"), "Karnataka"],
    [page.locator("#business-postalCode"), "560 001"],
    [page.locator("#pickup-contactName"), "Asha Rao"],
    [page.locator("#pickup-phone"), "98765 43210"],
  ]);
}

test("signed-out visitors sign up and come back to onboarding", async ({
  page,
}) => {
  await page.goto("/merchant/onboarding");
  await expect(page).toHaveURL(
    /\/auth\/sign-in\?next=%2Fmerchant%2Fonboarding$/,
  );

  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(
    /\/auth\/sign-up\?next=%2Fmerchant%2Fonboarding$/,
  );
  await fillFields([
    [page.locator("#name"), "Asha Rao"],
    [page.locator("#email"), uniqueEmail("seller")],
    [page.locator("#password"), "Correct-Horse-9-Battery"],
  ]);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/merchant\/onboarding$/);
  await expect(page.getByRole("button", { name: "Create shop" })).toBeVisible();
});

test("a seller creates a shop, submits it and waits for review", async ({
  page,
}) => {
  await signUpFresh(page, "seller");
  await page.goto("/merchant/onboarding");
  await fillOnboardingForm(page, { storeName: "Lakshmi Silks" });
  // The slug follows the store name until edited by hand.
  await expect(page.locator("#slug")).toHaveValue("lakshmi-silks");
  await fillFields([[page.locator("#slug"), `lakshmi-${Date.now()}`]]);
  await page.getByRole("button", { name: "Create shop" }).click();

  await expect(page.getByText("Your shop is a draft")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Your shop is under review")).toBeVisible();

  await page.goto("/merchant/dashboard");
  await expect(page).toHaveURL(/\/merchant\/onboarding$/);
});

test("invalid input shows a field error and creates nothing", async ({
  page,
}) => {
  await signUpFresh(page, "typo");
  await page.goto("/merchant/onboarding");
  await fillOnboardingForm(page, {
    contactPhone: "12345",
    storeName: "Typo Traders",
  });
  await page.getByRole("button", { name: "Create shop" }).click();

  await expect(
    page.getByText("Enter a 10-digit Indian mobile number."),
  ).toBeVisible();
  const profile = await page.request.get("/api/v1/merchant/profile");
  expect(profile.status()).toBe(403);
});

test("an approved merchant sees the dashboard and locked fields", async ({
  browser,
  page,
}) => {
  await signUpFresh(page, "approved");
  const created = await onboardMerchant(page, {
    gstin: "29abcde1234f1z5",
    storeName: "Channapatna Toys",
  });
  const shopId = (created.data as { id: string }).id;
  await page.request.post("/api/v1/merchant/profile/submit");

  const admin = await adminSession(browser);
  const approved = await apiJson(
    await admin.page.request.post(`/api/v1/admin/merchants/${shopId}/approve`),
  );
  expect(approved.status).toBe(200);

  await page.goto("/merchant/onboarding");
  await expect(page).toHaveURL(/\/merchant\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Channapatna Toys" }),
  ).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  await page.goto("/merchant/profile");
  await expect(page.locator("#storeName")).toBeDisabled();
  await expect(page.locator("#gstin")).toBeDisabled();
  await expect(page.getByText("Unverified")).toBeVisible();
  await fillFields([[page.locator("#description"), "Lacquered wooden toys."]]);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  await page.goto("/merchant/settings/shipping");
  await expect(page.getByText("Warehouse")).toBeVisible();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();

  // Suspension applies on the merchant's very next request.
  await admin.page.request.post(`/api/v1/admin/merchants/${shopId}/suspend`);
  await page.goto("/merchant/dashboard");
  await expect(page).toHaveURL(/\/merchant\/onboarding$/);
  await expect(page.getByText(/suspended/i)).toBeVisible();
  await admin.context.close();
});
