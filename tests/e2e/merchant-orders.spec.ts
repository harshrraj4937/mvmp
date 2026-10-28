import {
  apiJson,
  expect,
  onboardMerchant,
  placeOrderViaApi,
  sessionEmail,
  signUpFresh,
  test,
  twoMakerCart,
} from "./helpers";

interface Variant {
  available: number;
  reserved: number;
}

async function stockOf(
  page: import("@playwright/test").Page,
  productId: string,
): Promise<Variant> {
  const product = await apiJson(
    await page.request.get(`/api/v1/merchant/products/${productId}`),
  );
  const [variant] = (product.body.data as { variants: Variant[] }).variants;
  return {
    available: variant?.available ?? -1,
    reserved: variant?.reserved ?? -1,
  };
}

test("makers work their own part of an order", async ({ browser, page }) => {
  const { itemA, itemB, makerB, nameA, nameB, shopper, storeB } =
    await twoMakerCart(browser, page);
  const number = await placeOrderViaApi(shopper);

  // Maker A: the new order shows in the nav and the overview.
  await page.goto("/merchant/dashboard");
  const nav = page.getByRole("navigation", { name: "Merchant navigation" });
  await expect(nav.getByRole("link", { name: "Orders 1" })).toBeVisible();
  await expect(
    page.locator(".metric", { hasText: "New orders" }).locator(".metric-value"),
  ).toHaveText("1");

  await nav.getByRole("link", { name: /Orders/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Orders" }),
  ).toBeVisible();
  await page.getByRole("link", { name: `${number}-A` }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${number}-A` }),
  ).toBeVisible();
  const partAUrl = page.url();
  await expect(page.getByText("Asha Naik")).toBeVisible();
  await expect(page.getByText("+919876543210")).toBeVisible();
  await expect(page.getByText("Cash on delivery: collect ₹349")).toBeVisible();
  await expect(page.getByText(nameA)).toBeVisible();
  await expect(page.getByText(nameB)).toHaveCount(0);

  for (const step of ["Start preparing", "Start packing", "Mark packed"]) {
    await page.getByRole("button", { name: step }).click();
    await expect(page.getByRole("button", { name: step })).toHaveCount(0);
  }
  await expect(
    page.locator(".order-status-line").getByText("Packed — waiting for pickup"),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { exact: true, name: "Orders" }),
  ).toBeVisible();
  expect(await stockOf(page, itemA.productId)).toEqual({
    available: 3,
    reserved: 1,
  });
  await page.goto(`/merchant/products/${itemA.productId}`);
  await expect(page.getByText("1 held for orders")).toBeVisible();

  // Maker B: cannot open A's part; cancels their own as out of stock.
  // The desk streams behind merchant/loading.tsx, so a missing page renders
  // the not-found view under a 200 status.
  await makerB.goto(partAUrl);
  await expect(makerB.getByText("This page could not be found.")).toBeVisible();
  await expect(makerB.getByText("Asha Naik")).toHaveCount(0);
  await makerB.goto("/merchant/orders");
  await makerB.getByRole("link", { name: `${number}-B` }).click();
  await makerB.getByRole("button", { name: "Cancel order" }).click();
  await makerB.getByRole("radio", { name: "Out of stock" }).check();
  await makerB.getByRole("button", { name: "Cancel this order" }).click();
  await expect(makerB.getByText("Cancelled: Out of stock")).toBeVisible();
  expect(await stockOf(makerB, itemB.productId)).toEqual({
    available: 2,
    reserved: 0,
  });

  await shopper.goto(`/orders/${number}`);
  await expect(
    shopper.getByText(`Cancelled by ${storeB}: Out of stock`),
  ).toBeVisible();

  // The shopper cancels A's packed parcel: the piece is on sale again.
  const cancelled = await shopper.request.post(
    `/api/v1/orders/${number}/cancel`,
    { data: { merchantOrder: `${number}-A` } },
  );
  expect(cancelled.status()).toBe(200);
  expect(await stockOf(page, itemA.productId)).toEqual({
    available: 4,
    reserved: 0,
  });

  // Maker A signs out from the desk.
  await page.goto("/merchant/orders");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect(await sessionEmail(page)).toBeNull();
});

test("a draft shop can sign out of the desk", async ({ page }) => {
  await signUpFresh(page, "draftsignout");
  await onboardMerchant(page);
  await page.goto("/merchant/onboarding");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect(await sessionEmail(page)).toBeNull();
});
