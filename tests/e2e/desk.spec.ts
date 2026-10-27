import {
  approvedMerchant,
  expect,
  onboardMerchant,
  signUpFresh,
  test,
} from "./helpers";

test("an approved merchant sees the desk with real nav only", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, "Channapatna Toys");
  await page.goto("/merchant/dashboard");
  const nav = page.getByRole("navigation", { name: "Merchant navigation" });
  for (const name of ["Overview", "Products", "Store profile", "Shipping"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: /Orders|Reviews/ })).toHaveCount(
    0,
  );
  await expect(page.getByText(/demo mode|sample/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();

  await nav.getByRole("link", { name: "Store profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Your store, your story." }),
  ).toBeVisible();
  await expect(page.getByText("YOUR GILLU STORE")).toBeVisible();
});

test("a draft shop sees no Products link and no search", async ({ page }) => {
  await signUpFresh(page, "draftdesk");
  await onboardMerchant(page);
  await page.goto("/merchant/onboarding");
  await expect(page.getByText("Your shop is a draft")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Merchant navigation" });
  await expect(nav.getByRole("link", { name: "Shop status" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});

test("phone width: the desk menu opens and closes", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, "Mitti Studio");
  await page.setViewportSize({ height: 780, width: 360 });
  await page.goto("/merchant/dashboard");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Merchant navigation" });
  await expect(nav.getByRole("link", { name: "Shipping" })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
